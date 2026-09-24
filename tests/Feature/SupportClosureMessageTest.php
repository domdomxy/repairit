<?php

use App\Models\AutoResponse;
use App\Models\Report;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\ReportClosed;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function clAdmin(): User
{
    return User::factory()->create(['role' => 'admin']);
}

function clUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function clTicket(?User $owner = null, string $status = 'open'): SupportTicket
{
    $owner ??= clUser();

    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $owner->id,
        'category' => 'question',
        'subject' => 'Leaky sink',
        'status' => $status,
        'last_activity_at' => now(),
    ]);

    $ticket->messages()->create(['user_id' => $owner->id, 'from_staff' => false, 'body' => 'My sink is leaking']);

    return $ticket;
}

function clReport(?User $reporter = null): Report
{
    return Report::create([
        'reporter_id' => ($reporter ?? clUser())->id,
        'reported_user_id' => clUser()->id,
        'user_report' => true,
        'reason' => 'spam',
    ]);
}

function clLastMessage(SupportTicket $ticket)
{
    return $ticket->messages()->latest('id')->first();
}

// ---------------------------------------------------------- support

test('resolving a ticket posts the automatic closure message', function () {
    Notification::fake();
    $ticket = clTicket();

    $this->actingAs(clAdmin())->post(route('admin.support.status', $ticket), ['status' => 'resolved']);

    $last = clLastMessage($ticket);

    expect($last->is_automated)->toBeTrue()
        ->and($last->from_staff)->toBeTrue()
        ->and($last->user_id)->toBeNull()
        ->and($last->body)->toBe(AutoResponse::DEFAULTS['support_closure.resolved'])
        ->and($ticket->fresh()->status)->toBe('resolved');
});

test('closing a ticket posts the closed message, whoever closes it, and only once', function () {
    $owner = clUser();
    $ticket = clTicket($owner);

    $this->actingAs($owner)->post(route('support.close', $ticket));
    $this->actingAs($owner)->post(route('support.close', $ticket));

    $automated = $ticket->messages()->where('is_automated', true)->get();

    expect($automated)->toHaveCount(1)
        ->and($automated->first()->body)->toBe(AutoResponse::DEFAULTS['support_closure.closed']);

    $this->actingAs($owner)
        ->get(route('support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->where('thread.1.automated', true)
            ->where('thread.1.author', 'Support team'));
});

test('an admin reply that also closes the ticket is followed by the closure message', function () {
    Notification::fake();
    $ticket = clTicket();

    $this->actingAs(clAdmin())->post(route('admin.support.reply', $ticket), ['body' => 'All fixed.', 'status' => 'closed']);

    $messages = $ticket->messages()->orderBy('id')->get();

    expect($messages)->toHaveCount(3)
        ->and($messages[1]->body)->toBe('All fixed.')
        ->and($messages[1]->is_automated)->toBeFalse()
        ->and($messages[2]->is_automated)->toBeTrue()
        ->and($messages[2]->body)->toBe(AutoResponse::DEFAULTS['support_closure.closed']);
});

test('replies that do not change the status add no closure message', function () {
    Notification::fake();
    $owner = clUser();
    $ticket = clTicket($owner, 'resolved');

    // The admin answering a resolved ticket leaves it resolved; the owner answering reopens it.
    $this->actingAs(clAdmin())->post(route('admin.support.reply', $ticket), ['body' => 'Anything else?']);
    $this->actingAs($owner)->post(route('support.reply', $ticket), ['body' => 'Still leaking']);

    expect($ticket->messages()->where('is_automated', true)->count())->toBe(0)
        ->and($ticket->fresh()->status)->toBe('open');
});

test('an admin can change the closure wording, and turn it off', function () {
    Notification::fake();
    $admin = clAdmin();

    $this->actingAs($admin)
        ->put(route('admin.auto-responses.update', ['type' => 'support_closure', 'category' => 'resolved']), [
            'enabled' => true,
            'body' => 'Glad we could help — reply here if it comes back.',
        ])
        ->assertSessionHasNoErrors();

    $first = clTicket();
    $this->actingAs($admin)->post(route('admin.support.status', $first), ['status' => 'resolved']);

    expect(clLastMessage($first)->body)->toBe('Glad we could help — reply here if it comes back.');

    $this->actingAs($admin)
        ->put(route('admin.auto-responses.update', ['type' => 'support_closure', 'category' => 'closed']), [
            'enabled' => false,
            'body' => null,
        ]);

    $second = clTicket();
    $this->actingAs($admin)->post(route('admin.support.status', $second), ['status' => 'closed']);

    expect($second->fresh()->status)->toBe('closed')
        ->and($second->messages()->count())->toBe(1);
});

test('a guest ticket gets the closure message too', function () {
    Notification::fake();
    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'guest_token' => SupportTicket::generateGuestToken(),
        'guest_name' => 'Gina',
        'guest_email' => 'gina@example.test',
        'category' => 'question',
        'subject' => 'Hello',
        'status' => 'open',
        'last_activity_at' => now(),
    ]);
    $ticket->messages()->create(['user_id' => null, 'from_staff' => false, 'body' => 'Hi']);

    $this->actingAs(clAdmin())->post(route('admin.support.status', $ticket), ['status' => 'closed']);

    $this->get(route('support.guest.show', ['ticket' => $ticket->id, 'token' => $ticket->guest_token]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('thread', 2)
            ->where('thread.1.automated', true)
            ->where('thread.1.body', AutoResponse::DEFAULTS['support_closure.closed']));
});

// ---------------------------------------------------------- reports

test('resolving or dismissing a report tells the reporter with the matching text', function (string $status) {
    Notification::fake();
    $reporter = clUser();
    $report = clReport($reporter);

    $this->actingAs(clAdmin())->post(route('admin.reports.status', $report), ['status' => $status, 'note' => 'internal only']);

    Notification::assertSentTo($reporter, ReportClosed::class, function (ReportClosed $notification) use ($status, $reporter) {
        return $notification->status === $status
            && $notification->text === AutoResponse::DEFAULTS["report_closure.{$status}"]
            && ! str_contains(json_encode($notification->toArray($reporter)), 'internal only');
    });
})->with(['resolved', 'dismissed']);

test('a report closure message goes out once, on the step out of open', function () {
    Notification::fake();
    $reporter = clUser();
    $report = clReport($reporter);
    $admin = clAdmin();

    $this->actingAs($admin)->post(route('admin.reports.status', $report), ['status' => 'resolved']);
    // Correcting the decision must not send a second, contradicting message.
    $this->actingAs($admin)->post(route('admin.reports.status', $report), ['status' => 'dismissed']);

    Notification::assertSentToTimes($reporter, ReportClosed::class, 1);
});

test('the report closure message can be reworded or turned off, and skips suspended reporters', function () {
    Notification::fake();
    $admin = clAdmin();

    $this->actingAs($admin)->put(route('admin.auto-responses.update', ['type' => 'report_closure', 'category' => 'resolved']), [
        'enabled' => true,
        'body' => 'Handled — thank you.',
    ]);

    $reporter = clUser();
    $this->actingAs($admin)->post(route('admin.reports.status', clReport($reporter)), ['status' => 'resolved']);

    Notification::assertSentTo($reporter, ReportClosed::class, fn (ReportClosed $n) => $n->text === 'Handled — thank you.');

    $this->actingAs($admin)->put(route('admin.auto-responses.update', ['type' => 'report_closure', 'category' => 'dismissed']), [
        'enabled' => false,
        'body' => null,
    ]);

    $quiet = clUser();
    $this->actingAs($admin)->post(route('admin.reports.status', clReport($quiet)), ['status' => 'dismissed']);
    Notification::assertNotSentTo($quiet, ReportClosed::class);

    $suspended = clUser(['suspended_at' => now()]);
    $this->actingAs($admin)->post(route('admin.reports.status', clReport($suspended)), ['status' => 'resolved']);
    Notification::assertNotSentTo($suspended, ReportClosed::class);
});

// ------------------------------------------------------------ admin page

test('the auto-responses page lists the closure messages', function () {
    $this->actingAs(clAdmin())
        ->get(route('admin.auto-responses.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/AutoResponses/Index')
            ->has('supportClosures', 2)
            ->has('reportClosures', 2)
            ->where('supportClosures.0.category', 'resolved')
            ->where('supportClosures.0.default', AutoResponse::DEFAULTS['support_closure.resolved'])
            ->where('reportClosures.1.category', 'dismissed'));
});

test('only real closure outcomes can be edited', function () {
    $admin = clAdmin();

    $this->actingAs($admin)
        ->put(route('admin.auto-responses.update', ['type' => 'support_closure', 'category' => 'open']), ['enabled' => true, 'body' => 'x'])
        ->assertNotFound();
    $this->actingAs($admin)
        ->put(route('admin.auto-responses.update', ['type' => 'report_closure', 'category' => 'closed']), ['enabled' => true, 'body' => 'x'])
        ->assertNotFound();
    $this->actingAs(clUser())
        ->put(route('admin.auto-responses.update', ['type' => 'support_closure', 'category' => 'closed']), ['enabled' => true, 'body' => 'x'])
        ->assertForbidden();
});

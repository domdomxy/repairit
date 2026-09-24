<?php

use App\Models\AutoResponse;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Support\Facades\Notification;

function inTicket(string $status, bool $staffLast, int $hoursAgo, ?User $owner = null): SupportTicket
{
    $owner ??= User::factory()->create(['role' => 'customer']);

    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $owner->id,
        'category' => 'question',
        'subject' => 'Leaky sink',
        'status' => $status,
        'last_activity_at' => now()->subHours($hoursAgo),
    ]);

    $ticket->messages()->create(['user_id' => $owner->id, 'from_staff' => false, 'body' => 'Help']);

    if ($staffLast) {
        $ticket->messages()->create(['user_id' => null, 'from_staff' => true, 'body' => 'Try this']);
    }

    return $ticket;
}

test('a quiet ticket waiting on its owner is closed with the inactivity message', function () {
    Notification::fake();
    $owner = User::factory()->create(['role' => 'customer']);
    $ticket = inTicket('in_progress', true, 25, $owner);

    $this->artisan('support:close-inactive')->assertSuccessful();

    $ticket->refresh();
    $last = $ticket->messages()->latest('id')->first();

    expect($ticket->status)->toBe('closed')
        ->and($ticket->closed_at)->not->toBeNull()
        ->and($last->is_automated)->toBeTrue()
        ->and($last->body)->toBe(AutoResponse::DEFAULTS['support_closure.inactive']);

    Notification::assertSentTo($owner, SupportTicketStatusChanged::class, fn ($n) => $n->status === 'closed');
});

test('a resolved ticket that stays quiet is closed too', function () {
    Notification::fake();
    $ticket = inTicket('resolved', true, 30);

    $this->artisan('support:close-inactive');

    expect($ticket->fresh()->status)->toBe('closed');
});

test('tickets that are recent, or waiting on staff, are left alone', function () {
    Notification::fake();
    $recent = inTicket('in_progress', true, 5);
    $waitingOnStaff = inTicket('open', false, 72);
    $ownerWroteLast = inTicket('in_progress', false, 72);

    $this->artisan('support:close-inactive');

    expect($recent->fresh()->status)->toBe('in_progress')
        ->and($waitingOnStaff->fresh()->status)->toBe('open')
        ->and($ownerWroteLast->fresh()->status)->toBe('in_progress');
    Notification::assertNothingSent();
});

test('turning the inactivity message off still closes the ticket, silently in the thread', function () {
    Notification::fake();
    AutoResponse::create(['type' => 'support_closure', 'category' => 'inactive', 'enabled' => false]);
    $ticket = inTicket('in_progress', true, 48);

    $this->artisan('support:close-inactive');

    expect($ticket->fresh()->status)->toBe('closed')
        ->and($ticket->messages()->where('is_automated', true)->count())->toBe(0);
});

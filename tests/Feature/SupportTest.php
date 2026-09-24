<?php

use App\Models\AdminLog;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\AccountSuspended;
use App\Notifications\NewSupportTicket;
use App\Notifications\SupportReply;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function supAdmin(array $attributes = []): User
{
    return User::factory()->create(['role' => 'admin', ...$attributes]);
}

function supUser(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function supTicket(User $owner, array $attributes = [], string $body = 'My sink is leaking'): SupportTicket
{
    $ticket = SupportTicket::create([
        'tracking_id' => SupportTicket::generateTrackingId(),
        'user_id' => $owner->id,
        'category' => 'question',
        'subject' => 'Leaky sink',
        'status' => 'open',
        'last_activity_at' => now(),
        ...$attributes,
    ]);

    $ticket->messages()->create(['user_id' => $owner->id, 'from_staff' => false, 'body' => $body]);

    return $ticket;
}

function supPayload(array $overrides = []): array
{
    return ['category' => 'bug', 'subject' => 'Cannot upload', 'body' => 'The upload button does nothing.', ...$overrides];
}

function supMails(): Collection
{
    return app('mail.manager')->mailer('array')->getSymfonyTransport()->messages();
}

// ---------------------------------------------------------------- access

test('guests are sent to the login page', function () {
    $this->get(route('support.index'))->assertRedirect(route('login'));
    $this->get(route('support.create'))->assertRedirect(route('login'));
    $this->post(route('support.store'), supPayload())->assertRedirect(route('login'));
});

test('non-admins cannot use the admin support pages', function () {
    $user = supUser();
    $ticket = supTicket($user);

    $this->actingAs($user);

    $this->get(route('admin.support.index'))->assertForbidden();
    $this->get(route('admin.support.show', $ticket))->assertForbidden();
    $this->post(route('admin.support.reply', $ticket), ['body' => 'hi'])->assertForbidden();
    $this->post(route('admin.support.status', $ticket), ['status' => 'closed'])->assertForbidden();

    expect($ticket->fresh()->status)->toBe('open');
    expect($ticket->messages()->count())->toBe(1);
});

test('a ticket belongs to its owner and is invisible to everyone else', function () {
    $owner = supUser();
    $other = supUser();
    $ticket = supTicket($owner);

    $this->actingAs($other);

    $this->get(route('support.show', $ticket))->assertNotFound();
    $this->post(route('support.reply', $ticket), ['body' => 'hi'])->assertNotFound();
    $this->post(route('support.close', $ticket))->assertNotFound();

    expect($ticket->fresh()->status)->toBe('open');
    expect($ticket->messages()->count())->toBe(1);
});

test('the ticket list shows only my own tickets', function () {
    $this->withoutVite();
    $me = supUser();
    supTicket($me, ['subject' => 'Mine']);
    supTicket(supUser(), ['subject' => 'Not mine']);

    $this->actingAs($me)
        ->get(route('support.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Support/Index')
            ->has('tickets.data', 1)
            ->where('tickets.data.0.subject', 'Mine'));
});

// -------------------------------------------------------------- creating

test('opening a ticket stores it with its first message and a tracking id', function () {
    Notification::fake();
    $user = supUser();

    $response = $this->actingAs($user)->post(route('support.store'), supPayload([
        'subject' => '  Cannot upload  ',
        'body' => '  The upload button does nothing.  ',
    ]));

    $ticket = SupportTicket::firstOrFail();

    $response->assertRedirect(route('support.show', $ticket));
    expect($ticket->tracking_id)->toMatch('/^SUP-[A-HJ-KM-NP-Z2-9]{6}$/');
    expect($ticket->only('user_id', 'category', 'subject', 'status'))
        ->toBe(['user_id' => $user->id, 'category' => 'bug', 'subject' => 'Cannot upload', 'status' => 'open']);

    $message = $ticket->messages()->where('is_automated', false)->sole();
    expect($message->body)->toBe('The upload button does nothing.');
    expect($message->from_staff)->toBeFalse();
    expect($message->user_id)->toBe($user->id);
});

test('a ticket needs a valid category, subject and message', function (array $override) {
    $this->actingAs(supUser())
        ->post(route('support.store'), supPayload($override))
        ->assertSessionHasErrors(array_key_first($override));

    expect(SupportTicket::count())->toBe(0);
})->with([
    'no category' => [['category' => '']],
    'unknown category' => [['category' => 'nonsense']],
    'no subject' => [['subject' => '']],
    'subject too long' => [['subject' => str_repeat('a', 151)]],
    'no message' => [['body' => '']],
    'message too long' => [['body' => str_repeat('a', 5001)]],
]);

test('opening a ticket notifies the other admins but not the author or suspended admins', function () {
    Notification::fake();
    $author = supAdmin();
    $otherAdmin = supAdmin();
    $suspendedAdmin = supAdmin(['suspended_at' => now()]);
    $customer = supUser();

    $this->actingAs($author)->post(route('support.store'), supPayload());

    Notification::assertSentTo($otherAdmin, NewSupportTicket::class);
    Notification::assertNotSentTo($author, NewSupportTicket::class);
    Notification::assertNotSentTo($suspendedAdmin, NewSupportTicket::class);
    Notification::assertNotSentTo($customer, NewSupportTicket::class);
});

test('a user cannot have more than five active tickets', function () {
    Notification::fake();
    $user = supUser();

    foreach (range(1, 5) as $i) {
        supTicket($user, ['subject' => "Ticket {$i}"]);
    }

    $this->actingAs($user)
        ->post(route('support.store'), supPayload())
        ->assertSessionHasErrors('subject');

    expect(SupportTicket::count())->toBe(5);
});

test('resolved and closed tickets do not count towards the limit', function () {
    Notification::fake();
    $user = supUser();

    foreach (range(1, 3) as $i) {
        supTicket($user, ['status' => 'open']);
    }
    supTicket($user, ['status' => 'resolved']);
    supTicket($user, ['status' => 'closed']);
    supTicket($user, ['status' => 'closed']);

    $this->actingAs($user)
        ->post(route('support.store'), supPayload())
        ->assertSessionHasNoErrors();

    expect(SupportTicket::count())->toBe(7);
});

test('creating tickets is rate limited', function () {
    $user = supUser();
    $this->actingAs($user);

    foreach (range(1, 6) as $i) {
        $this->post(route('support.store'), supPayload(['subject' => '']))->assertSessionHasErrors('subject');
    }

    $this->post(route('support.store'), supPayload())->assertStatus(429);
});

// ---------------------------------------------------------- user replies

test('a reply from the owner is stored and the admins are told', function () {
    Notification::fake();
    $owner = supUser();
    $admin = supAdmin();
    $ticket = supTicket($owner, ['status' => 'in_progress']);

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['body' => 'Any news?'])
        ->assertSessionHasNoErrors();

    $reply = $ticket->messages()->latest('id')->first();
    expect($reply->body)->toBe('Any news?');
    expect($reply->from_staff)->toBeFalse();
    expect($ticket->fresh()->status)->toBe('in_progress');

    Notification::assertSentTo($admin, SupportReply::class, fn ($n) => $n->message->is($reply) && ! $n->message->from_staff);
    Notification::assertNotSentTo($owner, SupportReply::class);
});

test('replying to a resolved ticket reopens it', function () {
    Notification::fake();
    $owner = supUser();
    $ticket = supTicket($owner, ['status' => 'resolved']);

    $this->actingAs($owner)->post(route('support.reply', $ticket), ['body' => 'Still broken']);

    expect($ticket->fresh()->status)->toBe('open');
});

test('a closed ticket cannot be replied to', function () {
    Notification::fake();
    $owner = supUser();
    $ticket = supTicket($owner, ['status' => 'closed']);

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['body' => 'Hello?'])
        ->assertSessionHasErrors('body');

    expect($ticket->messages()->count())->toBe(1);
    Notification::assertNothingSent();
});

test('an empty reply is rejected', function () {
    $owner = supUser();
    $ticket = supTicket($owner);

    $this->actingAs($owner)->post(route('support.reply', $ticket), ['body' => ''])->assertSessionHasErrors('body');

    expect($ticket->messages()->count())->toBe(1);
});

test('the owner can close their ticket, and closing twice is harmless', function () {
    $owner = supUser();
    $ticket = supTicket($owner);

    $this->actingAs($owner)->post(route('support.close', $ticket))->assertSessionHasNoErrors();

    $closedAt = $ticket->fresh()->closed_at;
    expect($ticket->fresh()->status)->toBe('closed');
    expect($closedAt)->not->toBeNull();

    $this->travel(5)->minutes();
    $this->actingAs($owner)->post(route('support.close', $ticket));

    expect($ticket->fresh()->closed_at->equalTo($closedAt))->toBeTrue();
});

// ------------------------------------------------------------- the queue

test('the admin queue puts work that needs a person first', function () {
    $this->withoutVite();
    $user = supUser();
    supTicket($user, ['subject' => 'closed one', 'status' => 'closed', 'last_activity_at' => now()]);
    supTicket($user, ['subject' => 'resolved one', 'status' => 'resolved', 'last_activity_at' => now()]);
    supTicket($user, ['subject' => 'in progress', 'status' => 'in_progress', 'last_activity_at' => now()->subDay()]);
    supTicket($user, ['subject' => 'old open', 'status' => 'open', 'last_activity_at' => now()->subDays(3)]);
    supTicket($user, ['subject' => 'new open', 'status' => 'open', 'last_activity_at' => now()->subHour()]);

    $this->actingAs(supAdmin())
        ->get(route('admin.support.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Support/Index')
            ->where('tickets.data.0.subject', 'new open')
            ->where('tickets.data.1.subject', 'old open')
            ->where('tickets.data.2.subject', 'in progress')
            ->where('tickets.data.3.subject', 'resolved one')
            ->where('tickets.data.4.subject', 'closed one')
            ->where('counts.open', 2)
            ->where('counts.closed', 1));
});

test('the admin queue can be filtered and searched', function () {
    $this->withoutVite();
    $amira = supUser(['name' => 'Amira Ben Salah', 'email' => 'amira@example.com']);
    $karim = supUser(['name' => 'Karim', 'email' => 'karim@example.com']);
    $first = supTicket($amira, ['subject' => 'Refund question', 'category' => 'question']);
    supTicket($karim, ['subject' => 'Broken map', 'category' => 'bug', 'status' => 'resolved']);

    $admin = supAdmin();

    $subjects = fn (array $query) => collect(
        $this->actingAs($admin)->get(route('admin.support.index', $query))->viewData('page')['props']['tickets']['data']
    )->pluck('subject')->all();

    expect($subjects(['status' => 'resolved']))->toBe(['Broken map']);
    expect($subjects(['category' => 'question']))->toBe(['Refund question']);
    expect($subjects(['q' => 'amira@example']))->toBe(['Refund question']);
    expect($subjects(['q' => 'Karim']))->toBe(['Broken map']);
    expect($subjects(['q' => $first->tracking_id]))->toBe(['Refund question']);
    expect($subjects(['status' => 'nonsense']))->toHaveCount(2);
});

test('an admin sees the requester and the whole thread', function () {
    $this->withoutVite();
    $owner = supUser(['name' => 'Amira', 'email' => 'amira@example.com']);
    $ticket = supTicket($owner, [], 'First message');
    $admin = supAdmin(['name' => 'Sami Admin']);
    $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'Looking into it']);

    $this->actingAs($admin)
        ->get(route('admin.support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Support/Show')
            ->where('ticket.user.email', 'amira@example.com')
            ->has('thread', 2)
            ->where('thread.0.author', 'Amira')
            ->where('thread.1.author', 'Sami Admin')
            ->where('thread.1.from_staff', true));
});

test('a customer sees staff as "Support team", never an admin\'s name', function () {
    $this->withoutVite();
    $owner = supUser();
    $ticket = supTicket($owner);
    $admin = supAdmin(['name' => 'Sami Admin']);
    $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'On it']);

    $this->actingAs($owner)
        ->get(route('support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Support/Show')
            ->where('thread.1.author', 'Support team')
            ->where('ticket.tracking_id', $ticket->tracking_id));
});

// --------------------------------------------------------- admin replying

test('an admin reply is stored as staff, moves the ticket on, tells the owner and is logged', function () {
    Notification::fake();
    $owner = supUser();
    $admin = supAdmin();
    $ticket = supTicket($owner);

    $this->actingAs($admin)
        ->post(route('admin.support.reply', $ticket), ['body' => 'Try clearing your cache.'])
        ->assertSessionHasNoErrors();

    $reply = $ticket->messages()->latest('id')->first();
    expect($reply->from_staff)->toBeTrue();
    expect($reply->user_id)->toBe($admin->id);
    expect($ticket->fresh()->status)->toBe('in_progress');

    Notification::assertSentTo($owner, SupportReply::class, fn ($n) => $n->message->is($reply) && $n->newStatus === 'in_progress');

    $log = AdminLog::where('action', 'support.replied')->sole();
    expect($log->admin_id)->toBe($admin->id);
    expect($log->description)->toContain($ticket->tracking_id);
});

test('a reply can settle the ticket in the same step', function () {
    Notification::fake();
    $ticket = supTicket(supUser());

    $this->actingAs(supAdmin())
        ->post(route('admin.support.reply', $ticket), ['body' => 'Fixed, thanks!', 'status' => 'resolved']);

    expect($ticket->fresh()->status)->toBe('resolved');
    expect($ticket->fresh()->closed_at)->toBeNull();
});

test('a reply that closes the ticket records when', function () {
    Notification::fake();
    $ticket = supTicket(supUser());

    $this->actingAs(supAdmin())
        ->post(route('admin.support.reply', $ticket), ['body' => 'Closing this.', 'status' => 'closed']);

    expect($ticket->fresh()->status)->toBe('closed');
    expect($ticket->fresh()->closed_at)->not->toBeNull();
});

test('replying without a status change keeps a resolved ticket resolved', function () {
    Notification::fake();
    $owner = supUser();
    $ticket = supTicket($owner, ['status' => 'resolved']);

    $this->actingAs(supAdmin())->post(route('admin.support.reply', $ticket), ['body' => 'One more thing.']);

    expect($ticket->fresh()->status)->toBe('resolved');
    Notification::assertSentTo($owner, SupportReply::class, fn ($n) => $n->newStatus === null);
});

test('an admin cannot reply to a closed ticket until it is reopened', function () {
    Notification::fake();
    $ticket = supTicket(supUser(), ['status' => 'closed']);

    $this->actingAs(supAdmin())
        ->post(route('admin.support.reply', $ticket), ['body' => 'Hello'])
        ->assertSessionHasErrors('body');

    expect($ticket->messages()->count())->toBe(1);
    expect(AdminLog::count())->toBe(0);
    Notification::assertNothingSent();
});

test('admin replies are validated', function (array $payload) {
    $ticket = supTicket(supUser());

    $this->actingAs(supAdmin())
        ->post(route('admin.support.reply', $ticket), $payload)
        ->assertSessionHasErrors(array_key_first($payload));

    expect($ticket->messages()->count())->toBe(1);
})->with([
    'empty body' => [['body' => '']],
    'unknown status' => [['status' => 'nonsense', 'body' => 'x']],
]);

test('a suspended owner is not sent a reply notification', function () {
    Notification::fake();
    $owner = supUser(['suspended_at' => now()]);
    $ticket = supTicket($owner);

    $this->actingAs(supAdmin())->post(route('admin.support.reply', $ticket), ['body' => 'We are looking at your appeal.']);

    expect($ticket->messages()->count())->toBe(2);
    Notification::assertNothingSent();
});

// ------------------------------------------------------- status changes

test('an admin can change a status, which is logged and told to the owner', function () {
    Notification::fake();
    $owner = supUser();
    $admin = supAdmin();
    $ticket = supTicket($owner);

    $this->actingAs($admin)
        ->post(route('admin.support.status', $ticket), ['status' => 'resolved'])
        ->assertSessionHasNoErrors();

    expect($ticket->fresh()->status)->toBe('resolved');
    Notification::assertSentTo($owner, SupportTicketStatusChanged::class, fn ($n) => $n->status === 'resolved');

    $log = AdminLog::where('action', 'support.status_changed')->sole();
    expect($log->description)->toContain($ticket->tracking_id)->toContain('open')->toContain('resolved');
});

test('setting the same status changes nothing and tells no one', function () {
    Notification::fake();
    $ticket = supTicket(supUser());

    $this->actingAs(supAdmin())->post(route('admin.support.status', $ticket), ['status' => 'open']);

    Notification::assertNothingSent();
    expect(AdminLog::count())->toBe(0);
});

test('an invalid status is rejected', function () {
    $ticket = supTicket(supUser());

    $this->actingAs(supAdmin())
        ->post(route('admin.support.status', $ticket), ['status' => 'banana'])
        ->assertSessionHasErrors('status');

    expect($ticket->fresh()->status)->toBe('open');
});

test('reopening a closed ticket clears its closed time and lets people reply again', function () {
    Notification::fake();
    $owner = supUser();
    $ticket = supTicket($owner, ['status' => 'closed', 'closed_at' => now()]);

    $this->actingAs(supAdmin())->post(route('admin.support.status', $ticket), ['status' => 'open']);

    expect($ticket->fresh()->closed_at)->toBeNull();

    $this->actingAs($owner)
        ->post(route('support.reply', $ticket), ['body' => 'Thanks for reopening'])
        ->assertSessionHasNoErrors();
});

// ---------------------------------------------------- notifications & UI

test('opening a ticket marks its notifications read and leaves the rest', function () {
    $this->withoutVite();
    $owner = supUser();
    $admin = supAdmin();
    $ticket = supTicket($owner);
    $other = supTicket($owner, ['subject' => 'Other']);

    $ticketMessage = $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'Hi']);
    $otherMessage = $other->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'Hi']);
    $owner->notify(new SupportReply($ticket, $ticketMessage));
    $owner->notify(new SupportReply($other, $otherMessage));

    $this->actingAs($owner)->get(route('support.show', $ticket))->assertOk();

    $remaining = $owner->unreadNotifications()->get();
    expect($remaining)->toHaveCount(1);
    expect($remaining[0]->data['ticket_id'])->toBe($other->id);
});

test('each notification links to the right page for whoever receives it', function () {
    $owner = supUser(['name' => 'Amira']);
    $admin = supAdmin(['name' => 'Sami Admin']);
    $ticket = supTicket($owner);
    $fromStaff = $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'From staff']);
    $fromUser = $ticket->messages()->create(['user_id' => $owner->id, 'from_staff' => false, 'body' => 'From user']);

    $toOwner = (new SupportReply($ticket, $fromStaff))->toArray($owner);
    $toAdmin = (new SupportReply($ticket, $fromUser))->toArray($admin);
    $created = (new NewSupportTicket($ticket))->toArray($admin);
    $changed = (new SupportTicketStatusChanged($ticket, 'in_progress'))->toArray($owner);

    expect($toOwner['url'])->toBe("/support/{$ticket->id}");
    expect($toAdmin['url'])->toBe("/admin/support/{$ticket->id}");
    expect($created['url'])->toBe("/admin/support/{$ticket->id}");
    expect($changed['url'])->toBe("/support/{$ticket->id}");
    expect($changed['title'])->toContain('in progress');
    expect($toAdmin['title'])->toContain('Amira');
});

test('support emails carry no ticket text and cannot inject a link through a name', function () {
    $owner = supUser(['name' => '[Reset your password](https://evil.example/login)']);
    $admin = supAdmin();
    $ticket = supTicket($owner, ['subject' => 'private-subject-xyz'], 'private-body-xyz');

    $html = (string) (new NewSupportTicket($ticket))->toMail($admin)->render();

    expect($html)->not->toContain('private-subject-xyz');
    expect($html)->not->toContain('private-body-xyz');
    expect($html)->not->toContain('href="https://evil.example');
    expect($html)->toContain(route('admin.support.show', $ticket));
});

test('a ticket and its reply really are stored and emailed', function () {
    $owner = supUser(['email' => 'amira@example.com']);
    $admin = supAdmin(['email' => 'boss@example.com']);

    $this->actingAs($owner)->post(route('support.store'), supPayload(['body' => 'secret-body-123']));
    $ticket = SupportTicket::firstOrFail();

    expect($admin->notifications()->count())->toBe(1);
    expect($admin->notifications()->first()->data['url'])->toBe("/admin/support/{$ticket->id}");

    $this->actingAs($admin)->post(route('admin.support.reply', $ticket), ['body' => 'secret-reply-456']);

    expect($owner->notifications()->count())->toBe(1);
    expect($owner->notifications()->first()->data['url'])->toBe("/support/{$ticket->id}");

    $mails = supMails();
    expect($mails)->toHaveCount(2);
    expect($mails->map(fn ($m) => $m->getOriginalMessage()->getTo()[0]->getAddress())->all())
        ->toBe(['boss@example.com', 'amira@example.com']);
    $mails->each(fn ($m) => expect($m->getOriginalMessage()->getHtmlBody())
        ->not->toContain('secret-body-123')
        ->not->toContain('secret-reply-456'));
});

test('a user who turned emails off still gets the in-app notification', function () {
    $owner = supUser(['email_notifications' => false]);
    $ticket = supTicket($owner);

    $this->actingAs(supAdmin())->post(route('admin.support.reply', $ticket), ['body' => 'Hello']);

    expect($owner->notifications()->count())->toBe(1);
    expect(supMails())->toHaveCount(0);
});

// ------------------------------------------------------- data lifecycle

test('deleting a user deletes their tickets and messages', function () {
    $owner = supUser();
    $keeper = supUser();
    supTicket($owner);
    supTicket($keeper);

    $owner->delete();

    expect(SupportTicket::count())->toBe(1);
    expect(SupportMessage::count())->toBe(1);
});

test('a deleted admin\'s replies stay in the ticket', function () {
    $this->withoutVite();
    $owner = supUser();
    $admin = supAdmin();
    $ticket = supTicket($owner);
    $ticket->messages()->create(['user_id' => $admin->id, 'from_staff' => true, 'body' => 'Answer']);

    $admin->delete();

    expect($ticket->messages()->count())->toBe(2);

    $this->actingAs(supAdmin())
        ->get(route('admin.support.show', $ticket))
        ->assertInertia(fn (Assert $page) => $page->where('thread.1.author', 'Deleted user'));
});

test('the admin dashboard counts tickets that still need handling', function () {
    $this->withoutVite();
    $user = supUser();
    supTicket($user, ['status' => 'open']);
    supTicket($user, ['status' => 'in_progress']);
    supTicket($user, ['status' => 'resolved']);
    supTicket($user, ['status' => 'closed']);

    $this->actingAs(supAdmin())
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('stats.tickets_open', 2));
});

// ------------------------------------------------- suspension email loop

test('the suspension email tells people how to reach support', function () {
    config(['mail.support.address' => 'help@repairit.test']);
    $user = supUser();

    $mail = (new AccountSuspended)->toMail($user);
    $html = (string) $mail->render();

    expect($html)->toContain('help@repairit.test');
    expect($mail->replyTo[0][0])->toBe('help@repairit.test');
});

<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Review;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\AccountRestored;
use App\Notifications\AccountSuspended;
use App\Notifications\NewMessage;
use App\Notifications\NewReview;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

function notifTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function notifCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function notifConversation(User $customer, User $technician): Conversation
{
    return Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
}

function notifSend(User $from, Conversation $conversation, string $body = 'Hello there'): void
{
    test()->actingAs($from)
        ->post(route('messages.store', $conversation), ['body' => $body])
        ->assertSessionHasNoErrors();
}

function notifMails(): Collection
{
    return app('mail.manager')->mailer('array')->getSymfonyTransport()->messages();
}

// -------------------------------------------------------- new messages

test('the recipient, and only the recipient, is notified of a new message', function () {
    Notification::fake();
    $customer = notifCustomer();
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation, 'Can you fix my sink?');

    Notification::assertSentTo($technician, NewMessage::class, fn ($n) => $n->message->body === 'Can you fix my sink?');
    Notification::assertNotSentTo($customer, NewMessage::class);
});

test('a run of unread messages notifies once, not per message', function () {
    Notification::fake();
    $customer = notifCustomer();
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation, 'One');
    notifSend($customer, $conversation, 'Two');
    notifSend($customer, $conversation, 'Three');

    Notification::assertSentToTimes($technician, NewMessage::class, 1);
});

test('once the recipient has read the conversation the next message notifies again', function () {
    $this->withoutVite();
    Notification::fake();
    $customer = notifCustomer();
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation, 'One');
    $this->actingAs($technician)->get(route('conversations.show', $conversation))->assertOk();
    notifSend($customer, $conversation, 'Two');

    Notification::assertSentToTimes($technician, NewMessage::class, 2);
});

test('each side is notified about the other side\'s messages independently', function () {
    Notification::fake();
    $customer = notifCustomer();
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation, 'Question');
    notifSend($technician, $conversation, 'Answer');

    Notification::assertSentToTimes($technician, NewMessage::class, 1);
    Notification::assertSentToTimes($customer, NewMessage::class, 1);
});

test('messaging a suspended user is refused and notifies no one', function () {
    Notification::fake();
    $customer = notifCustomer();
    $technician = notifTechnician();
    $technician->suspended_at = now();
    $technician->save();
    $conversation = notifConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['body' => 'Hello'])
        ->assertForbidden();

    Notification::assertNothingSent();
});

test('an attachment-only message still notifies, with a placeholder instead of text', function () {
    Storage::fake('local');
    $customer = notifCustomer(['name' => 'Amira']);
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['attachment' => UploadedFile::fake()->create('leak.pdf', 20, 'application/pdf')])
        ->assertSessionHasNoErrors();

    $data = $technician->notifications()->first()->data;

    expect($data['title'])->toBe('New message from Amira');
    expect($data['body'])->toBe('Sent an attachment');
});

test('an admin can be messaged and notified like anyone else', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $customer = notifCustomer();
    $conversation = notifConversation($customer, $admin);

    // notifConversation puts the second user in the technician seat.
    notifSend($customer, $conversation, 'Question for the team');

    expect($admin->notifications()->count())->toBe(1);
});

test('a message is stored in the app, and emailed without its text', function () {
    $customer = notifCustomer(['name' => 'Amira']);
    $technician = notifTechnician(['email' => 'sami@example.com']);
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation, 'My boiler is leaking, secret-detail-123');

    $stored = $technician->notifications()->get();
    expect($stored)->toHaveCount(1);
    expect($stored[0]->data)->toMatchArray([
        'kind' => 'message',
        'title' => 'New message from Amira',
        'conversation_id' => $conversation->id,
        'url' => "/messages/{$conversation->id}",
    ]);
    expect($stored[0]->data['body'])->toContain('secret-detail-123');

    expect(notifMails())->toHaveCount(1);
    $mail = notifMails()->first()->getOriginalMessage();
    expect($mail->getTo()[0]->getAddress())->toBe('sami@example.com');
    expect($mail->getSubject())->toBe('New message from Amira');
    expect($mail->getHtmlBody())->not->toContain('secret-detail-123');
    expect($mail->getHtmlBody())->toContain(route('conversations.show', $conversation));
});

test('a user who turned emails off still gets the in-app notification', function () {
    $customer = notifCustomer();
    $technician = notifTechnician(['email_notifications' => false]);
    $conversation = notifConversation($customer, $technician);

    notifSend($customer, $conversation);

    expect($technician->notifications()->count())->toBe(1);
    expect(notifMails())->toHaveCount(0);
});

test('the email is skipped when the message was read in the meantime', function () {
    $customer = notifCustomer();
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);
    $message = $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);

    $notification = new NewMessage($message);

    expect($notification->shouldSend($technician, 'mail'))->toBeTrue();

    $message->update(['read_at' => now()]);

    expect($notification->shouldSend($technician, 'mail'))->toBeFalse();
    expect($notification->shouldSend($technician, 'database'))->toBeTrue();
});

test('user-controlled text cannot inject a link into the email', function () {
    $customer = notifCustomer(['name' => '[Verify your account](https://evil.example/login)']);
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);
    $message = $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);

    $html = (string) (new NewMessage($message))->toMail($technician)->render();

    expect($html)->not->toContain('href="https://evil.example');
    expect($html)->toContain(route('conversations.show', $conversation));
});

test('the message channels depend on the email preference', function () {
    $message = new Message;

    $on = User::factory()->create(['email_notifications' => true]);
    $off = User::factory()->create(['email_notifications' => false]);

    expect((new NewMessage($message))->via($on))->toBe(['database', 'broadcast', 'mail']);
    expect((new NewMessage($message))->via($off))->toBe(['database', 'broadcast']);
    expect((new NewReview(new Review))->via($off))->toBe(['database', 'broadcast']);
});

// ------------------------------------------------------------- reviews

test('a technician is notified of a new review but not when it is edited', function () {
    Notification::fake();
    $customer = notifCustomer(['name' => 'Amira']);
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);
    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Hello']);

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 5, 'comment' => 'Great']);
    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 4]);

    Notification::assertSentToTimes($technician, NewReview::class, 1);
    Notification::assertSentTo($technician, NewReview::class, fn ($n) => $n->review->rating === 5);
});

test('a review notification carries the rating and links to the technician page', function () {
    $customer = notifCustomer(['name' => 'Amira']);
    $technician = notifTechnician();
    $conversation = notifConversation($customer, $technician);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);
    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Hello']);

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 3, 'comment' => 'Okay']);

    $data = $technician->notifications()->first()->data;

    expect($data)->toMatchArray([
        'kind' => 'review',
        'title' => 'Amira left you a 3-star review',
        'body' => 'Okay',
        'url' => "/technicians/{$technician->id}",
    ]);
});

// -------------------------------------------------- suspension emails

test('suspending and restoring a user emails them', function () {
    Notification::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    $customer = notifCustomer();

    $this->actingAs($admin)->post(route('admin.users.suspend', $customer));
    Notification::assertSentTo($customer, AccountSuspended::class);

    $this->actingAs($admin)->post(route('admin.users.unsuspend', $customer));
    Notification::assertSentTo($customer, AccountRestored::class);
});

test('suspending someone who is already suspended does not email them again', function () {
    Notification::fake();
    $admin = User::factory()->create(['role' => 'admin']);
    $customer = notifCustomer();
    $customer->suspended_at = now();
    $customer->save();

    $this->actingAs($admin)->post(route('admin.users.suspend', $customer));

    Notification::assertNothingSent();
});

test('account emails ignore the email preference', function () {
    $optedOut = User::factory()->create(['email_notifications' => false]);

    expect((new AccountSuspended)->via($optedOut))->toBe(['mail']);
    expect((new AccountRestored)->via($optedOut))->toBe(['mail']);
});

test('the suspension email is actually delivered', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $customer = notifCustomer(['email' => 'amira@example.com']);

    $this->actingAs($admin)->post(route('admin.users.suspend', $customer));

    $mail = notifMails()->first()->getOriginalMessage();
    expect($mail->getTo()[0]->getAddress())->toBe('amira@example.com');
    expect($mail->getSubject())->toContain('suspended');
});

// ----------------------------------------------------- notifications UI

test('the notifications page lists only my notifications', function () {
    $this->withoutVite();
    $me = notifCustomer();
    $other = notifCustomer();
    $sender = notifTechnician(['name' => 'Sami']);

    $me->notify(new NewMessage(
        notifConversation($me, $sender)->messages()->create(['sender_id' => $sender->id, 'body' => 'For me'])
    ));
    $other->notify(new NewMessage(
        notifConversation($other, $sender)->messages()->create(['sender_id' => $sender->id, 'body' => 'Not for me'])
    ));

    $this->actingAs($me)
        ->get(route('notifications.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Notifications/Index')
            ->has('items.data', 1)
            ->where('items.data.0.title', 'New message from Sami')
            ->where('items.data.0.body', 'For me')
            ->where('items.data.0.read_at', null)
            ->where('notifications.unread', 1));
});

test('opening a notification marks it read and goes to its page', function () {
    $me = notifCustomer();
    $sender = notifTechnician();
    $conversation = notifConversation($me, $sender);
    $me->notify(new NewMessage($conversation->messages()->create(['sender_id' => $sender->id, 'body' => 'Hi'])));
    $notification = $me->notifications()->first();

    $this->actingAs($me)
        ->post(route('notifications.read', $notification->id))
        ->assertRedirect("/messages/{$conversation->id}");

    expect($notification->fresh()->read_at)->not->toBeNull();
});

test('nobody can open or mark someone else\'s notification', function () {
    $owner = notifCustomer();
    $intruder = notifCustomer();
    $sender = notifTechnician();
    $owner->notify(new NewMessage(
        notifConversation($owner, $sender)->messages()->create(['sender_id' => $sender->id, 'body' => 'Hi'])
    ));
    $notification = $owner->notifications()->first();

    $this->actingAs($intruder)
        ->post(route('notifications.read', $notification->id))
        ->assertNotFound();

    expect($notification->fresh()->read_at)->toBeNull();
});

test('a notification pointing off-site is never followed', function () {
    $me = notifCustomer();
    $me->notifications()->create([
        'id' => (string) Str::uuid(),
        'type' => NewMessage::class,
        'data' => ['title' => 'x', 'url' => 'https://evil.example'],
    ]);

    $this->actingAs($me)
        ->from('/notifications')
        ->post(route('notifications.read', $me->notifications()->first()->id))
        ->assertRedirect('/notifications');
});

test('everything can be marked read at once', function () {
    $me = notifCustomer();
    $other = notifCustomer();
    $sender = notifTechnician();

    foreach ([$me, $other] as $user) {
        $conversation = notifConversation($user, $sender);
        $user->notify(new NewMessage($conversation->messages()->create(['sender_id' => $sender->id, 'body' => 'Hi'])));
    }

    $this->actingAs($me)->post(route('notifications.read-all'))->assertSessionHasNoErrors();

    expect($me->unreadNotifications()->count())->toBe(0);
    expect($other->unreadNotifications()->count())->toBe(1);
});

test('opening a conversation clears that conversation\'s notifications only', function () {
    $this->withoutVite();
    $me = notifCustomer();
    $first = notifTechnician();
    $second = notifTechnician();
    $opened = notifConversation($me, $first);
    $untouched = notifConversation($me, $second);

    foreach ([[$opened, $first], [$untouched, $second]] as [$conversation, $sender]) {
        $me->notify(new NewMessage($conversation->messages()->create(['sender_id' => $sender->id, 'body' => 'Hi'])));
    }

    $this->actingAs($me)->get(route('conversations.show', $opened))->assertOk();

    $remaining = $me->unreadNotifications()->get();
    expect($remaining)->toHaveCount(1);
    expect($remaining[0]->data['conversation_id'])->toBe($untouched->id);
});

// ---------------------------------------------------------- preference

test('the email preference can be changed from the profile', function () {
    $user = notifCustomer();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'email_notifications' => false])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->email_notifications)->toBeFalse();

    // Omitting the field leaves the choice alone.
    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => 'New Name', 'email' => $user->email]);

    expect($user->fresh()->email_notifications)->toBeFalse();
});

test('new users get emails by default', function () {
    expect(User::factory()->create()->fresh()->email_notifications)->toBeTrue();
});

// ---------------------------------------------------- live channel auth

test('a user can only listen to their own notification channel', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'key',
        'broadcasting.connections.reverb.secret' => 'secret',
        'broadcasting.connections.reverb.app_id' => 'id',
    ]);

    // Channels are registered on the active driver at boot; we just switched
    // driver, so register them again on the new one.
    Broadcast::purge();
    require base_path('routes/channels.php');

    $me = notifCustomer();
    $other = notifCustomer();

    $this->actingAs($me)
        ->post('/broadcasting/auth', ['channel_name' => "private-App.Models.User.{$me->id}", 'socket_id' => '1234.5678'])
        ->assertOk();

    $this->actingAs($me)
        ->post('/broadcasting/auth', ['channel_name' => "private-App.Models.User.{$other->id}", 'socket_id' => '1234.5678'])
        ->assertForbidden();
});

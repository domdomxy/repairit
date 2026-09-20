<?php

use App\Events\InboxUpdated;
use App\Models\Conversation;
use App\Models\TechnicianProfile;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function inboxTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function inboxCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function inboxConversation(User $customer, User $technician): Conversation
{
    return Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
}

/** Sends a message the way the app does, so last_message_at and the rest are set. */
function inboxSend(User $from, Conversation $conversation, string $body): void
{
    test()->actingAs($from)
        ->post(route('messages.store', $conversation), ['body' => $body])
        ->assertSessionHasNoErrors();
}

test('a new message is unread in the recipient\'s panel, not the sender\'s', function () {
    $this->withoutVite();
    $customer = inboxCustomer(['name' => 'Amira']);
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'My sink is leaking');

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 1)
            ->where('inbox.unread_requests', 1)
            ->has('inbox.recent', 0)
            ->has('inbox.requests', 1)
            ->where('inbox.requests.0.id', $conversation->id)
            ->where('inbox.requests.0.name', 'Amira')
            ->where('inbox.requests.0.unread_count', 1)
            ->where('inbox.requests.0.is_request', true)
            ->where('inbox.requests.0.last_message.preview', 'My sink is leaking')
            ->where('inbox.requests.0.last_message.from_me', false));

    $this->actingAs($customer)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 0)
            ->where('inbox.recent.0.last_message.from_me', true)
            ->where('inbox.recent.0.is_request', false));
});

test('replying moves a request into the inbox tab, and each tab counts its own unread', function () {
    $this->withoutVite();
    $me = inboxTechnician();
    $answered = inboxConversation(inboxCustomer(), $me);
    $waiting = inboxConversation(inboxCustomer(), $me);
    $mine = inboxConversation($me, inboxTechnician());

    inboxSend($answered->customer, $answered, 'Question');
    inboxSend($waiting->customer, $waiting, 'Anyone there?');
    inboxSend($mine->technician, $mine, 'Reply to my message');
    inboxSend($me, $answered, 'On my way');

    $this->actingAs($me)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            // The answered conversation is still unread: replying doesn't open it.
            ->where('inbox.unread', 3)
            ->where('inbox.unread_requests', 1)
            ->has('inbox.requests', 1)
            ->where('inbox.requests.0.id', $waiting->id)
            ->has('inbox.recent', 2)
            // Newest first: the reply just sent, then the older conversation.
            ->where('inbox.recent.0.id', $answered->id)
            ->where('inbox.recent.1.id', $mine->id));
});

test('the badge counts conversations with something unread, not messages', function () {
    $this->withoutVite();
    $me = inboxTechnician();
    $first = inboxConversation(inboxCustomer(), $me);
    $second = inboxConversation(inboxCustomer(), $me);

    inboxSend($first->customer, $first, 'One');
    inboxSend($first->customer, $first, 'Two');
    inboxSend($first->customer, $first, 'Three');
    inboxSend($second->customer, $second, 'Hello');

    $this->actingAs($me)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 2));
});

test('reading a conversation clears it from the count', function () {
    $this->withoutVite();
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'Hello');

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 0));
});

test('the panel lists the newest conversations first, at most eight per tab', function () {
    $this->withoutVite();
    $me = inboxTechnician();

    foreach (range(1, 10) as $i) {
        $conversation = inboxConversation(inboxCustomer(['name' => "Customer {$i}"]), $me);
        inboxSend($conversation->customer, $conversation, "Message {$i}");
        $conversation->update(['last_message_at' => now()->subMinutes(20 - $i)]);
    }

    $this->actingAs($me)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 10)
            ->where('inbox.unread_requests', 10)
            ->has('inbox.requests', 8)
            ->where('inbox.requests.0.name', 'Customer 10')
            ->where('inbox.requests.7.name', 'Customer 3'));
});

test('hidden conversations and empty ones stay out of the panel', function () {
    $this->withoutVite();
    $me = inboxTechnician();
    $hidden = inboxConversation(inboxCustomer(), $me);
    $empty = inboxConversation(inboxCustomer(), $me);
    $shown = inboxConversation(inboxCustomer(), $me);

    inboxSend($hidden->customer, $hidden, 'Hidden one');
    inboxSend($shown->customer, $shown, 'Shown one');
    $hidden->updateStateFor($me, ['hidden_at' => now()]);

    $this->actingAs($me)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 1)
            ->has('inbox.requests', 1)
            ->where('inbox.requests.0.id', $shown->id)
            ->has('inbox.recent', 0));
});

test('a conversation someone deleted for themselves stays out until something new arrives', function () {
    $this->withoutVite();
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'Old');
    $this->actingAs($technician)->delete(route('conversations.destroy', $conversation));

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 0)->has('inbox.recent', 0)->has('inbox.requests', 0));

    inboxSend($customer, $conversation, 'New');

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 1)
            ->where('inbox.requests.0.last_message.preview', 'New'));
});

test('a file without text shows a placeholder in the panel', function () {
    $this->withoutVite();
    Storage::fake('local');
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['attachments' => [
            UploadedFile::fake()->create('one.pdf', 20, 'application/pdf'),
        ]])
        ->assertSessionHasNoErrors();

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('inbox.requests.0.last_message.preview', 'Sent an attachment'));
});

test('a message deleted for everyone shows as deleted in the panel and is not unread', function () {
    $this->withoutVite();
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'Regrettable');
    $this->actingAs($customer)
        ->delete(route('messages.destroy', $conversation->messages()->firstOrFail()), ['scope' => 'everyone']);

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('inbox.unread', 0)
            ->where('inbox.recent.0.last_message.preview', 'This message was deleted'));
});

test('messages are not in the notifications bell, and the messages page no longer touches it', function () {
    $this->withoutVite();
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'Hello');

    expect($technician->notifications()->count())->toBe(0);

    $this->actingAs($technician)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unread', 0)
            ->has('notifications.recent', 0));
});

test('the migration removes the message notifications already stored, and only those', function () {
    $user = inboxCustomer();

    foreach ([App\Notifications\NewMessage::class => 'message', App\Notifications\NewReview::class => 'review'] as $type => $kind) {
        $user->notifications()->create([
            'id' => (string) Illuminate\Support\Str::uuid(),
            'type' => $type,
            'data' => ['kind' => $kind, 'title' => $kind],
        ]);
    }

    (require database_path('migrations/2026_09_20_160000_delete_message_notifications.php'))->up();

    expect($user->notifications()->pluck('type')->all())->toBe([App\Notifications\NewReview::class]);
});

test('the recipient\'s panel is told to refresh when a message is sent, edited or taken back', function () {
    Event::fake([InboxUpdated::class]);
    $customer = inboxCustomer();
    $technician = inboxTechnician();
    $conversation = inboxConversation($customer, $technician);

    inboxSend($customer, $conversation, 'Hello');

    Event::assertDispatchedTimes(InboxUpdated::class, 1);
    Event::assertDispatched(InboxUpdated::class, fn ($event) => $event->userId === $technician->id
        && $event->broadcastAs() === 'inbox.updated'
        && $event->broadcastWith() === []);

    $message = $conversation->messages()->firstOrFail();

    $this->actingAs($customer)->patch(route('messages.update', $message), ['body' => 'Hello again']);
    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);

    Event::assertDispatchedTimes(InboxUpdated::class, 3);
    Event::assertNotDispatched(InboxUpdated::class, fn ($event) => $event->userId === $customer->id);
});

test('guests get no inbox and the login page still renders', function () {
    $this->withoutVite();

    $this->get(route('login'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('inbox.unread', 0)->where('inbox.recent', [])->where('inbox.requests', []));
});

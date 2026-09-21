<?php

use App\Events\MessageUpdated;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Quote;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewMessage;
use App\Notifications\NewQuote;
use App\Support\ConversationList;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function rcCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function rcTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id, 'city' => 'Tunis']);

    return $technician;
}

function rcRequest(User $customer, array $attributes = []): ServiceRequest
{
    return $customer->serviceRequests()->create([
        'description' => 'The screen cracked when I dropped it.',
        'city' => 'Sfax',
        'budget' => 'Up to 100 TND',
        ...$attributes,
    ]);
}

// --- sending a request in the chat ------------------------------------------

test('a technician can send a request in the chat with its customer', function () {
    Notification::fake();

    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)
        ->post(route('requests.share', $serviceRequest), ['message' => 'I can fix this today.'])
        ->assertRedirect();

    $conversation = Conversation::sole();
    $message = Message::sole();

    expect($conversation->customer_id)->toBe($customer->id)
        ->and($conversation->technician_id)->toBe($technician->id)
        ->and($message->sender_id)->toBe($technician->id)
        ->and($message->service_request_id)->toBe($serviceRequest->id)
        ->and($message->body)->toBe('I can fix this today.')
        ->and($message->forClient()['request']['url'])->toBe(route('requests.show', $serviceRequest, absolute: false))
        ->and($message->forClient()['quote'])->toBeNull();

    // The customer is told like for any other message.
    Notification::assertSentTo($customer, NewMessage::class);
});

test('the request card in the chat keeps working after the request is deleted', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer, ['description' => 'Washing machine will not drain']);

    $this->actingAs($technician)->post(route('requests.share', $serviceRequest));

    expect(Message::sole()->forClient()['request']['id'])->toBe($serviceRequest->id);

    $serviceRequest->delete();

    $card = Message::sole()->fresh()->forClient()['request'];

    expect($card['url'])->toBeNull()
        ->and($card['excerpt'])->toBe('Washing machine will not drain');
});

test('only a technician can send somebody else\'s request in the chat', function () {
    $customer = rcCustomer();
    $serviceRequest = rcRequest($customer);

    // Not a technician, and not their own request.
    $this->actingAs(rcCustomer())->post(route('requests.share', $serviceRequest))->assertForbidden();
    $this->actingAs($customer)->post(route('requests.share', $serviceRequest))->assertForbidden();
    // A suspended customer's request is not there.
    $this->actingAs(rcTechnician())->post(route('requests.share', rcRequest(rcCustomer(['suspended_at' => now()]))))->assertNotFound();

    expect(Message::count())->toBe(0);
});

test('a shared request cannot be edited as a message', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();

    $this->actingAs($technician)->post(route('requests.share', rcRequest($customer)), ['message' => 'Hello']);

    $this->actingAs($technician)
        ->patch(route('messages.update', Message::sole()), ['body' => 'Changed'])
        ->assertForbidden();
});

// --- quotes in the chat -----------------------------------------------------

test('a quote is sent to the customer in the chat, with one notification only', function () {
    Notification::fake();

    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)
        ->post(route('requests.quotes.store', $serviceRequest), [
            'price' => '80 TND',
            'estimated_time' => '2 days',
            'message' => 'Original screen.',
        ])
        ->assertSessionHasNoErrors();

    $message = Message::sole();
    $card = $message->forClient()['quote'];

    expect(Conversation::sole()->customer_id)->toBe($customer->id)
        ->and($message->sender_id)->toBe($technician->id)
        ->and($message->body)->toBeNull()
        ->and($card['price'])->toBe('80 TND')
        ->and($card['estimated_time'])->toBe('2 days')
        ->and($card['message'])->toBe('Original screen.')
        ->and($card['request']['id'])->toBe($serviceRequest->id)
        // The quote has its own card: the same message is not also a shared request.
        ->and($message->forClient()['request'])->toBeNull();

    Notification::assertSentToTimes($customer, NewQuote::class, 1);
    Notification::assertNotSentTo($customer, NewMessage::class);
});

test('editing a quote changes its card instead of sending a second one, and keeps what it said', function () {
    Event::fake([MessageUpdated::class]);

    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '80 TND']);
    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '65 TND', 'message' => 'Cheaper.']);

    $message = Message::sole();
    $card = $message->fresh()->forClient()['quote'];

    expect($card['price'])->toBe('65 TND')
        ->and($card['message'])->toBe('Cheaper.')
        ->and($card['edited'])->toBeTrue()
        ->and($message->fresh()->quote_price)->toBe('65 TND')
        // The first version is kept, as with an edited message, for the admins.
        ->and($message->edits()->pluck('body')->all())->toBe(['Quote: 80 TND']);

    Event::assertDispatched(MessageUpdated::class, fn ($event) => $event->message->is($message));

    // Sending the very same quote again changes nothing.
    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '65 TND', 'message' => 'Cheaper.']);

    expect(Message::count())->toBe(1)->and($message->edits()->count())->toBe(1);
});

test('deleting a quote leaves its card in the chat saying it is gone', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '80 TND', 'message' => 'Original screen.']);
    $this->actingAs($technician)->delete(route('requests.quote.destroy', $serviceRequest))->assertRedirect();

    $message = Message::sole()->fresh();
    $card = $message->forClient()['quote'];

    expect(Quote::count())->toBe(0)
        ->and($card['id'])->toBeNull()
        ->and($card['price'])->toBe('80 TND')
        // What it said is kept for the admins.
        ->and($message->edits()->pluck('body')->all())->toBe(['Quote: 80 TND — Original screen.']);
});

test('after the customer chose a quote it can no longer be deleted from the chat', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '80 TND']);
    $this->actingAs($customer)->post(route('quotes.accept', Quote::sole()));

    $this->actingAs($technician)->delete(route('requests.quote.destroy', $serviceRequest))->assertForbidden();

    expect(Quote::count())->toBe(1)
        ->and(Message::sole()->fresh()->forClient()['quote']['accepted'])->toBeTrue();
});

test('a quote card cannot be edited as a message', function () {
    $technician = rcTechnician();

    $this->actingAs($technician)->post(route('requests.quotes.store', rcRequest(rcCustomer())), ['price' => '80 TND']);

    $this->actingAs($technician)
        ->patch(route('messages.update', Message::sole()), ['body' => 'Free!'])
        ->assertForbidden();
});

test('the conversation page carries the cards and the limits to edit a quote', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '80 TND']);

    $this->actingAs($customer)
        ->get(route('conversations.show', Conversation::sole()))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Messages/Show')
            ->where('messages.0.quote.price', '80 TND')
            ->where('messages.0.quote.request.id', $serviceRequest->id)
            ->where('quoteLimits.price_max', Quote::PRICE_MAX));
});

test('the conversation list says a quote or a request was sent', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();

    $this->actingAs($technician)->post(route('requests.quotes.store', rcRequest($customer)), ['price' => '80 TND']);

    expect(ConversationList::for($customer)->first()->last_message['preview'])->toBe('Sent a quote: 80 TND');

    $this->actingAs($technician)->post(route('requests.share', rcRequest($customer, ['description' => 'Broken hinge'])));

    expect(ConversationList::for($customer)->first()->last_message['preview'])->toBe('Shared a request: Broken hinge');
});

// --- the feed card ----------------------------------------------------------

test('a technician gets their own quote and the quote limits on the feed, and nobody else\'s', function () {
    $customer = rcCustomer();
    $technician = rcTechnician();
    $other = rcTechnician();
    $serviceRequest = rcRequest($customer);

    $serviceRequest->quotes()->create(['technician_id' => $technician->id, 'price' => '80 TND', 'message' => 'Mine']);
    $serviceRequest->quotes()->create(['technician_id' => $other->id, 'price' => '50 TND', 'message' => 'Theirs']);

    $this->actingAs($technician)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Feed/Index')
            ->where('quoteLimits.message_max', Quote::MESSAGE_MAX)
            ->where('feed.data.0.quotes_count', 2)
            ->where('feed.data.0.my_quote.price', '80 TND')
            ->where('feed.data.0.my_quote.message', 'Mine'));

    // A customer never gets the form, nor a quote.
    $this->actingAs($customer)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('quoteLimits', null)
            ->where('feed.data.0.my_quote', null));
});

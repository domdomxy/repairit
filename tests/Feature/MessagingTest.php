<?php

use App\Models\Category;
use App\Models\Conversation;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function messagingTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function messagingCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

test('a customer can start a conversation with a technician', function () {
    $customer = messagingCustomer();
    $technician = messagingTechnician();

    $response = $this->actingAs($customer)->post(route('conversations.start', $technician));

    $conversation = Conversation::firstOrFail();

    expect($conversation->customer_id)->toBe($customer->id)
        ->and($conversation->technician_id)->toBe($technician->id);

    $response->assertRedirect(route('conversations.show', $conversation));
});

test('any role can start a conversation with a technician as the customer', function () {
    $target = messagingTechnician();

    foreach ([messagingCustomer(), messagingTechnician(), User::factory()->create(['role' => 'admin'])] as $user) {
        $this->actingAs($user)
            ->post(route('conversations.start', $target))
            ->assertRedirect();

        $this->assertDatabaseHas('conversations', [
            'customer_id' => $user->id,
            'technician_id' => $target->id,
        ]);
    }
});

test('a technician cannot start a conversation with themselves', function () {
    $technician = messagingTechnician();

    $this->actingAs($technician)
        ->post(route('conversations.start', $technician))
        ->assertForbidden();

    expect(Conversation::count())->toBe(0);
});

test('a message cannot be sent to a suspended user', function () {
    $customer = messagingCustomer();
    $technician = messagingTechnician();

    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
    ]);

    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['body' => 'Are you still there?'])
        ->assertForbidden();

    expect($conversation->messages()->count())->toBe(0);
});

test('a message can still be sent when both accounts are active', function () {
    $customer = messagingCustomer();
    $technician = messagingTechnician();

    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
    ]);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['body' => 'Hello'])
        ->assertRedirect();

    expect($conversation->messages()->count())->toBe(1);
});

// ------------------------------------------------ inbox, requests and contact panel

/** A conversation with one message from its customer, as after "Message" and a first line. */
function messagingRequest(User $customer, User $technician, string $body = 'Can you fix my sink?'): Conversation
{
    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
        'last_message_at' => now(),
    ]);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => $body]);

    return $conversation;
}

test('a new conversation is a request for the technician until they reply', function () {
    $this->withoutVite();

    $customer = messagingCustomer();
    $technician = messagingTechnician();
    $conversation = messagingRequest($customer, $technician);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Messages/Index')
            ->where('conversations.0.is_request', true)
            ->where('conversations.0.unread_count', 1)
            ->where('conversations.0.last_message.preview', 'Can you fix my sink?')
            ->where('conversations.0.last_message.from_me', false)
            ->missing('conversations.0.has_incoming')
            ->missing('conversations.0.has_replied'));

    // The customer started it, so for them it is just a conversation.
    $this->actingAs($customer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.is_request', false)
            ->where('conversations.0.last_message.from_me', true));

    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Of course.']);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.is_request', false)
            ->where('conversations.0.last_message.from_me', true));
});

test('a conversation with nothing in it yet is not a request', function () {
    $this->withoutVite();

    $technician = messagingTechnician();
    Conversation::create(['customer_id' => messagingCustomer()->id, 'technician_id' => $technician->id]);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.is_request', false)
            ->where('conversations.0.last_message', null));
});

test('a technician who writes to another technician sees it as an ordinary conversation', function () {
    $this->withoutVite();

    $writer = messagingTechnician();
    $target = messagingTechnician();
    messagingRequest($writer, $target);

    // For the one who was written to it is a request; for the writer it is not.
    $this->actingAs($writer)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('conversations.0.is_request', false));

    $this->actingAs($target)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('conversations.0.is_request', true));
});

test('the open conversation page carries the list and knows whether it is a request', function () {
    $this->withoutVite();

    $technician = messagingTechnician();
    $conversation = messagingRequest(messagingCustomer(), $technician);

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Messages/Show')
            ->where('conversation.is_request', true)
            ->has('conversations', 1)
            // Opening it read the message, so the list no longer counts it as unread.
            ->where('conversations.0.unread_count', 0));
});

test('the contact panel shows a technician\'s public details and only the contact details they chose to show', function () {
    $this->withoutVite();

    $customer = messagingCustomer();
    $technician = messagingTechnician(['name' => 'Sami']);
    $profile = $technician->technicianProfile;
    $profile->update([
        'city' => 'Tunis',
        'bio' => 'Twenty years of plumbing.',
        'phone' => '20 123 456',
        'availability_status' => 'busy',
        'show_phone_publicly' => false,
        'show_email_publicly' => false,
    ]);
    $profile->categories()->attach(Category::create(['name' => 'Plumbing', 'slug' => 'plumbing'])->id);
    $conversation = messagingRequest($customer, $technician);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.id', $technician->id)
            ->where('contact.name', 'Sami')
            ->where('contact.role', 'technician')
            ->where('contact.profile.city', 'Tunis')
            ->where('contact.profile.availability_status', 'busy')
            ->where('contact.profile.categories', ['Plumbing'])
            ->where('contact.profile.phone', null)
            ->where('contact.email', null));

    $profile->update(['show_phone_publicly' => true, 'show_email_publicly' => true]);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.profile.phone', '20 123 456')
            ->where('contact.email', $technician->email));
});

test('the contact panel never shows a customer\'s email or profile', function () {
    $this->withoutVite();

    $customer = messagingCustomer();
    $technician = messagingTechnician();
    $conversation = messagingRequest($customer, $technician);

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.id', $customer->id)
            ->where('contact.role', 'customer')
            ->where('contact.profile', null)
            ->where('contact.email', null));
});

test('the contact panel shows only a name for a suspended account', function () {
    $this->withoutVite();

    $customer = messagingCustomer();
    $technician = messagingTechnician();
    $technician->technicianProfile->update(['city' => 'Tunis', 'bio' => 'Hidden']);
    $conversation = messagingRequest($customer, $technician);
    $technician->suspended_at = now();
    $technician->save();

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.suspended', true)
            ->where('contact.profile', null)
            ->where('contact.email', null));
});

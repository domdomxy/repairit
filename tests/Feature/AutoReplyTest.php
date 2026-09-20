<?php

use App\Models\Conversation;
use App\Models\Message;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function autoReplyTechnician(array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function autoReplyConversation(User $customer, User $technician): Conversation
{
    return Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
    ]);
}

test('the default auto-reply is sent after the first message', function () {
    $customer = User::factory()->create(['role' => 'customer', 'name' => 'Sara Ben Ali']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('messages.store', $conversation), ['body' => 'My washing machine is leaking'])
        ->assertRedirect();

    $messages = $conversation->messages()->orderBy('id')->get();

    expect($messages)->toHaveCount(2)
        ->and($messages[0]->sender_id)->toBe($customer->id)
        ->and($messages[0]->is_automated)->toBeFalse()
        ->and($messages[1]->sender_id)->toBe($technician->id)
        ->and($messages[1]->is_automated)->toBeTrue()
        ->and($messages[1]->body)->toBe(str_replace('{name}', 'Sara', TechnicianProfile::DEFAULT_AUTO_REPLY));
});

test('a technician can send their own auto-reply with the customer\'s name', function () {
    $customer = User::factory()->create(['role' => 'customer', 'name' => 'Sara Ben Ali']);
    $technician = autoReplyTechnician([
        'auto_reply_enabled' => true,
        'auto_reply_message' => 'Hello {name}, I answer after 6pm.',
    ]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi']);

    expect($conversation->messages()->orderByDesc('id')->first()->body)->toBe('Hello Sara, I answer after 6pm.');
});

test('nothing is sent when the auto-reply is off', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician();
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi']);

    expect($conversation->messages()->count())->toBe(1);
});

test('the auto-reply is sent only once', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'First']);
    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Second']);

    expect($conversation->messages()->where('is_automated', true)->count())->toBe(1);
});

test('deleting the first message does not earn another auto-reply', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'First']);
    $this->actingAs($customer)->delete(route('messages.destroy', $conversation->messages()->first()), ['scope' => 'everyone']);
    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Again']);

    expect($conversation->messages()->where('is_automated', true)->count())->toBe(1);
});

test('the technician writing first does not trigger an auto-reply', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'Hello, how can I help?']);
    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi']);

    expect($conversation->messages()->where('is_automated', true)->count())->toBe(0);
});

test('an auto-reply does not take the conversation out of requests', function () {
    $this->withoutVite();

    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Please help']);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.is_request', true)
            ->where('conversations.0.last_message.preview', 'Please help'));

    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'On my way']);

    $this->actingAs($technician)
        ->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page->where('conversations.0.is_request', false));
});

test('an auto-reply does not let the customer review the technician', function () {
    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi']);

    expect(App\Models\Review::conversationFor($customer, $technician))->toBeNull();

    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Sure']);

    expect(App\Models\Review::conversationFor($customer, $technician))->not->toBeNull();
});

test('the customer sees the auto-reply marked as automatic', function () {
    $this->withoutVite();

    $customer = User::factory()->create(['role' => 'customer']);
    $technician = autoReplyTechnician(['auto_reply_enabled' => true]);
    $conversation = autoReplyConversation($customer, $technician);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi']);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.automated', false)
            ->where('messages.1.automated', true));
});

test('a technician can turn the auto-reply on with a custom message', function () {
    $technician = autoReplyTechnician();
    $category = App\Models\Category::create(['name' => 'Phones', 'slug' => 'phones']);

    $this->actingAs($technician)
        ->put(route('technician.profile.update'), [
            'availability_status' => 'available',
            'categories' => [$category->id],
            'auto_reply_enabled' => true,
            'auto_reply_message' => '  Thanks {name}!  ',
        ])
        ->assertSessionHasNoErrors();

    $profile = $technician->technicianProfile()->first();

    expect($profile->auto_reply_enabled)->toBeTrue()
        ->and($profile->auto_reply_message)->toBe('Thanks {name}!');
});

test('an empty custom message falls back to the default and a too-long one is rejected', function () {
    $technician = autoReplyTechnician(['auto_reply_message' => 'Old message']);
    $category = App\Models\Category::create(['name' => 'Phones', 'slug' => 'phones']);
    $base = ['availability_status' => 'available', 'categories' => [$category->id], 'auto_reply_enabled' => true];

    $this->actingAs($technician)
        ->put(route('technician.profile.update'), [...$base, 'auto_reply_message' => ''])
        ->assertSessionHasNoErrors();

    expect($technician->technicianProfile()->first()->auto_reply_message)->toBeNull();

    $this->actingAs($technician)
        ->put(route('technician.profile.update'), [...$base, 'auto_reply_message' => str_repeat('a', TechnicianProfile::AUTO_REPLY_MAX_LENGTH + 1)])
        ->assertSessionHasErrors('auto_reply_message');
});

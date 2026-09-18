<?php

use App\Models\Conversation;
use App\Models\TechnicianProfile;
use App\Models\User;

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

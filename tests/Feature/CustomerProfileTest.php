<?php

use App\Models\Conversation;
use App\Models\CustomerReview;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function cpTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function cpCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function cpConversation(User $customer, User $technician, bool $technicianReplied = true): Conversation
{
    $conversation = Conversation::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
    ]);

    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi, can you help?']);

    if ($technicianReplied) {
        $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Sure.']);
    }

    return $conversation;
}

test('a customer has a public profile any signed-in user can open', function () {
    $this->withoutVite();

    $customer = cpCustomer();

    $this->actingAs(cpTechnician())
        ->get(route('customers.show', $customer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Customers/Show')
            ->where('customer.id', $customer->id)
            ->where('customer.name', $customer->name)
            ->where('customer.rating_count', 0)
            ->where('customer.rating_avg', null)
            ->missing('customer.email'));

    $this->actingAs(cpCustomer())->get(route('customers.show', $customer))->assertOk();
});

test('only signed-in users can open a customer profile', function () {
    $this->get(route('customers.show', cpCustomer()))->assertRedirect(route('login'));
});

test('technicians, admins and suspended customers have no customer profile', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $suspended = cpCustomer();
    $suspended->forceFill(['suspended_at' => now()])->save();

    $viewer = cpCustomer();

    $this->actingAs($viewer)->get(route('customers.show', cpTechnician()))->assertNotFound();
    $this->actingAs($viewer)->get(route('customers.show', $admin))->assertNotFound();
    $this->actingAs($viewer)->get(route('customers.show', $suspended))->assertNotFound();
});

test('a technician who has exchanged messages with a customer can rate them', function () {
    $technician = cpTechnician();
    $customer = cpCustomer();
    $conversation = cpConversation($customer, $technician);

    $this->actingAs($technician)
        ->post(route('customer-reviews.store', $customer), ['rating' => 4, 'comment' => 'Clear and polite.'])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('customer_reviews', [
        'technician_id' => $technician->id,
        'customer_id' => $customer->id,
        'conversation_id' => $conversation->id,
        'rating' => 4,
        'comment' => 'Clear and polite.',
    ]);

    $this->actingAs($technician)
        ->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canReview', true)
            ->where('myReview.rating', 4)
            ->where('customer.rating_count', 1)
            ->where('customer.rating_avg', fn ($average) => (float) $average === 4.0)
            ->where('customer.reviews.0.technician.id', $technician->id));
});

test('rating a customer again updates the rating instead of adding one', function () {
    $technician = cpTechnician();
    $customer = cpCustomer();
    cpConversation($customer, $technician);

    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 2]);
    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 5, 'comment' => 'Improved.']);

    expect(CustomerReview::count())->toBe(1)
        ->and(CustomerReview::first()->rating)->toBe(5);
});

test('the average is taken over every technician who rated the customer', function () {
    $customer = cpCustomer();

    foreach ([5, 3] as $rating) {
        $technician = cpTechnician();
        cpConversation($customer, $technician);
        $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => $rating]);
    }

    $this->actingAs(cpCustomer())
        ->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page
            ->where('customer.rating_count', 2)
            ->where('customer.rating_avg', fn ($average) => (float) $average === 4.0)
            ->where('canReview', false)
            ->where('myReview', null));
});

test('a technician cannot rate a customer they have not really talked to', function () {
    $technician = cpTechnician();
    $customer = cpCustomer();

    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 5])->assertForbidden();

    // The customer wrote but the technician has not answered yet.
    cpConversation($customer, $technician, technicianReplied: false);

    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 5])->assertForbidden();

    expect(CustomerReview::count())->toBe(0);
});

test('only technicians can rate customers', function () {
    $customer = cpCustomer();
    $other = cpCustomer();
    $technician = cpTechnician();
    cpConversation($customer, $technician);

    $this->actingAs($other)->post(route('customer-reviews.store', $customer), ['rating' => 5])->assertForbidden();

    expect(CustomerReview::count())->toBe(0);
});

test('a rating needs a value from 1 to 5', function () {
    $technician = cpTechnician();
    $customer = cpCustomer();
    cpConversation($customer, $technician);

    $this->actingAs($technician)
        ->post(route('customer-reviews.store', $customer), ['rating' => 6])
        ->assertSessionHasErrors('rating');

    $this->actingAs($technician)
        ->post(route('customer-reviews.store', $customer), [])
        ->assertSessionHasErrors('rating');
});

test('a technician can delete their rating of a customer', function () {
    $technician = cpTechnician();
    $customer = cpCustomer();
    cpConversation($customer, $technician);

    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 3]);
    $this->actingAs($technician)->delete(route('customer-reviews.destroy', $customer));

    expect(CustomerReview::count())->toBe(0);
});

test('the chat panel gives a customer contact a rating', function () {
    $this->withoutVite();

    $technician = cpTechnician();
    $customer = cpCustomer();
    $conversation = cpConversation($customer, $technician);

    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 5]);

    $this->actingAs($technician)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.role', 'customer')
            ->where('contact.rating_count', 1)
            ->where('contact.rating_avg', fn ($average) => (float) $average === 5.0));
});

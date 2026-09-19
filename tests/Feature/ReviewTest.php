<?php

use App\Models\Conversation;
use App\Models\Review;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function reviewTestTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function reviewTestCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function reviewTestConversation(User $customer, User $technician, bool $technicianReplied = true): Conversation
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

function reviewTestRating(User $technician): array
{
    $profile = TechnicianProfile::where('user_id', $technician->id)->first();

    return [(int) $profile->rating_count, (float) $profile->rating_avg];
}

test('a customer who has exchanged messages with a technician can review them', function () {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    $conversation = reviewTestConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('reviews.store', $technician), ['rating' => 4, 'comment' => 'Fast and tidy.'])
        ->assertSessionHasNoErrors();

    $this->assertDatabaseHas('reviews', [
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
        'conversation_id' => $conversation->id,
        'rating' => 4,
        'comment' => 'Fast and tidy.',
    ]);

    expect(reviewTestRating($technician))->toBe([1, 4.0]);
});

test('the technician rating is the average of all their reviews', function () {
    $technician = reviewTestTechnician();

    foreach ([4, 5] as $rating) {
        $customer = reviewTestCustomer();
        reviewTestConversation($customer, $technician);

        $this->actingAs($customer)
            ->post(route('reviews.store', $technician), ['rating' => $rating])
            ->assertSessionHasNoErrors();
    }

    expect(reviewTestRating($technician))->toBe([2, 4.5]);
});

test('reviewing again updates the existing review instead of adding another', function () {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    reviewTestConversation($customer, $technician);

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 2, 'comment' => 'Late.']);
    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 5]);

    expect(Review::count())->toBe(1);
    expect(Review::first()->comment)->toBeNull();
    expect(reviewTestRating($technician))->toBe([1, 5.0]);
});

test('a customer cannot review a technician they have not messaged', function () {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();

    $this->actingAs($customer)
        ->post(route('reviews.store', $technician), ['rating' => 5])
        ->assertForbidden();

    expect(Review::count())->toBe(0);
    expect(reviewTestRating($technician))->toBe([0, 0.0]);
});

test('a customer cannot review a technician who has not replied', function () {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    reviewTestConversation($customer, $technician, technicianReplied: false);

    $this->actingAs($customer)
        ->post(route('reviews.store', $technician), ['rating' => 5])
        ->assertForbidden();

    expect(Review::count())->toBe(0);
});

test('the rating must be a whole number from 1 to 5', function (mixed $rating) {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    reviewTestConversation($customer, $technician);

    $this->actingAs($customer)
        ->post(route('reviews.store', $technician), ['rating' => $rating])
        ->assertSessionHasErrors('rating');

    expect(Review::count())->toBe(0);
})->with([0, 6, 'great', null]);

test('any role can review a technician once they have exchanged messages', function () {
    $technician = reviewTestTechnician();

    $reviewers = [
        reviewTestTechnician(),
        User::factory()->create(['role' => 'admin']),
    ];

    foreach ($reviewers as $reviewer) {
        reviewTestConversation($reviewer, $technician);

        $this->actingAs($reviewer)
            ->post(route('reviews.store', $technician), ['rating' => 5])
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('reviews', [
            'customer_id' => $reviewer->id,
            'technician_id' => $technician->id,
            'rating' => 5,
        ]);
    }

    expect(reviewTestRating($technician))->toBe([2, 5.0]);
});

test('a technician acting as a customer still needs a conversation to review', function () {
    $technician = reviewTestTechnician();

    $this->actingAs(reviewTestTechnician())
        ->post(route('reviews.store', $technician), ['rating' => 5])
        ->assertForbidden();

    expect(Review::count())->toBe(0);
});

test('a technician cannot review themselves', function () {
    $technician = reviewTestTechnician();

    $this->actingAs($technician)
        ->post(route('reviews.store', $technician), ['rating' => 5])
        ->assertForbidden();

    expect(Review::count())->toBe(0);
});

test('reviews can only be left for technicians', function () {
    $customer = reviewTestCustomer();
    $anotherCustomer = reviewTestCustomer();

    $this->actingAs($customer)
        ->post(route('reviews.store', $anotherCustomer), ['rating' => 5])
        ->assertNotFound();
});

test('deleting a review recalculates the technician rating', function () {
    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    reviewTestConversation($customer, $technician);

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 3]);
    expect(reviewTestRating($technician))->toBe([1, 3.0]);

    $this->actingAs($customer)
        ->delete(route('reviews.destroy', $technician))
        ->assertSessionHasNoErrors();

    expect(Review::count())->toBe(0);
    expect(reviewTestRating($technician))->toBe([0, 0.0]);
});

test('a customer cannot delete another customer\'s review', function () {
    $technician = reviewTestTechnician();
    $author = reviewTestCustomer();
    $other = reviewTestCustomer();
    reviewTestConversation($author, $technician);

    $this->actingAs($author)->post(route('reviews.store', $technician), ['rating' => 4]);
    $this->actingAs($other)->delete(route('reviews.destroy', $technician));

    expect(Review::count())->toBe(1);
    expect(reviewTestRating($technician))->toBe([1, 4.0]);
});

test('the technician page tells an eligible customer they can review', function () {
    $this->withoutVite();

    $technician = reviewTestTechnician();
    $customer = reviewTestCustomer();
    reviewTestConversation($customer, $technician);

    $this->actingAs($customer)
        ->get(route('technicians.show', $technician))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Technicians/Show')
            ->where('canReview', true)
            ->where('myReview', null));

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 4, 'comment' => 'Good.']);

    $this->actingAs($customer)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canReview', true)
            ->where('myReview.rating', 4)
            ->where('myReview.comment', 'Good.'));
});

test('the technician page does not offer a review to a customer who has not messaged them', function () {
    $this->withoutVite();

    $technician = reviewTestTechnician();

    $this->actingAs(reviewTestCustomer())
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canReview', false)
            ->where('myReview', null));
});

test('the technician page offers a review to a technician who has messaged them', function () {
    $this->withoutVite();

    $technician = reviewTestTechnician();
    $otherTechnician = reviewTestTechnician();
    reviewTestConversation($otherTechnician, $technician);

    $this->actingAs($otherTechnician)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canReview', true)
            ->where('myReview', null));
});

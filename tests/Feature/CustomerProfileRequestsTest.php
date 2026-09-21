<?php

use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function cprCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function cprTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

/** A request has no title: `$text` is what the customer wrote, and how these tests tell requests apart. */
function cprRequest(User $customer, string $text, array $attributes = []): ServiceRequest
{
    return $customer->serviceRequests()->create([
        'description' => $text,
        ...$attributes,
    ]);
}

/** The titles of the requests the profile lists, in order. */
function cprTitles($test, User $customer): array
{
    $titles = [];

    $test->get(route('customers.show', $customer))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$titles) {
            $page->component('Customers/Show');
            $titles = collect($page->toArray()['props']['requests'])->pluck('description')->all();
        });

    return $titles;
}

test('the profile lists the customer\'s open requests, newest first', function () {
    $customer = cprCustomer();
    $older = cprRequest($customer, 'Leaking tap');
    cprRequest($customer, 'Cracked screen');
    cprRequest($customer, 'Old closed one', ['status' => 'closed']);
    cprRequest(cprCustomer(), 'Somebody else\'s');
    $older->forceFill(['created_at' => now()->subHour()])->save();

    expect(cprTitles($this->actingAs(cprTechnician()), $customer))->toBe(['Cracked screen', 'Leaking tap']);
});

test('the customer also sees their closed requests, and gets the panel to post another', function () {
    $customer = cprCustomer(['city' => 'Sousse']);
    cprRequest($customer, 'Open one');
    cprRequest($customer, 'Closed one', ['status' => 'closed']);

    $this->actingAs($customer);

    expect(cprTitles($this, $customer))->toEqualCanonicalizing(['Open one', 'Closed one']);

    $this->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page
            ->where('requestForm.defaultCity', 'Sousse')
            ->has('requestForm.categories')
            ->has('requestForm.limits.description_max'));
});

test('other people get no panel to post requests on someone else\'s profile', function () {
    $customer = cprCustomer();

    foreach ([cprTechnician(), cprCustomer(), User::factory()->create(['role' => 'admin'])] as $viewer) {
        $this->actingAs($viewer)
            ->get(route('customers.show', $customer))
            ->assertInertia(fn (Assert $page) => $page->where('requestForm', null));
    }
});

test('a technician sees which of the requests they already sent a quote to', function () {
    $customer = cprCustomer();
    $technician = cprTechnician();
    $answered = cprRequest($customer, 'Answered');
    cprRequest($customer, 'Waiting');
    $answered->quotes()->create(['technician_id' => $technician->id, 'price' => '80 TND']);

    $this->actingAs($technician)
        ->get(route('customers.show', $customer))
        ->assertInertia(function (Assert $page) {
            $requests = collect($page->toArray()['props']['requests'])->keyBy('description');

            expect($requests['Answered']['has_my_quote'])->toBeTrue()
                ->and($requests['Answered']['quotes_count'])->toBe(1)
                ->and($requests['Waiting']['has_my_quote'])->toBeFalse();
        });
});

test('the requests on a profile carry the public fields only', function () {
    $customer = cprCustomer(['email' => 'secret@example.com']);
    cprRequest($customer, 'Cracked screen', ['city' => 'Tunis']);

    $json = json_encode(
        $this->actingAs(cprTechnician())->get(route('customers.show', $customer))->viewData('page')['props']['requests'],
    );

    expect($json)->toContain('Cracked screen')
        ->toContain('Tunis')
        ->not->toContain('secret@example.com');
});

test('other people see the latest twenty open requests on a profile, the customer sees all of theirs', function () {
    $customer = cprCustomer();

    foreach (range(1, 25) as $i) {
        cprRequest($customer, "Request {$i}")->forceFill(['created_at' => now()->subMinutes(30 - $i)])->save();
    }

    $others = cprTitles($this->actingAs(cprCustomer()), $customer);

    expect($others)->toHaveCount(20)
        ->and($others[0])->toBe('Request 25')
        ->and($others[19])->toBe('Request 6');

    // Nowhere else lists their requests any more, so their own profile keeps every one.
    $own = cprTitles($this->actingAs($customer), $customer);

    expect($own)->toHaveCount(25)
        ->and($own[24])->toBe('Request 1');
});

test('a request posted from the profile panel sends the customer back to their profile', function () {
    $customer = cprCustomer();

    $this->actingAs($customer)
        ->from(route('customers.show', $customer))
        ->post(route('requests.store'), ['description' => 'Dropped it.', 'from_panel' => true])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('customers.show', $customer))
        ->assertSessionHas('success');

    expect(ServiceRequest::sole()->customer_id)->toBe($customer->id);
});

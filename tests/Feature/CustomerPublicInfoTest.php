<?php

use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function piCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function piTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

test('a customer can put a bio and a city on their public profile', function () {
    $this->withoutVite();

    $customer = piCustomer();

    $this->actingAs($customer)
        ->put(route('customer.profile.update'), ['bio' => "  I fix my own bike, mostly.\nBad with laptops.  ", 'city' => ' Tunis '])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('customer.profile.edit'));

    $customer->refresh();

    expect($customer->bio)->toBe("I fix my own bike, mostly.\nBad with laptops.")
        ->and($customer->city)->toBe('Tunis');

    // Anyone signed in sees it, but still never the email.
    $this->actingAs(piTechnician())
        ->get(route('customers.show', $customer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Customers/Show')
            ->where('customer.bio', "I fix my own bike, mostly.\nBad with laptops.")
            ->where('customer.city', 'Tunis')
            ->missing('customer.email'));
});

test('a customer with nothing filled in has an empty bio and city', function () {
    $this->withoutVite();

    $customer = piCustomer();

    $this->actingAs(piTechnician())
        ->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page
            ->where('customer.bio', null)
            ->where('customer.city', null));
});

test('emptying the fields clears them', function () {
    $customer = piCustomer();
    $customer->forceFill(['bio' => 'Hello', 'city' => 'Sfax'])->save();

    $this->actingAs($customer)
        ->put(route('customer.profile.update'), ['bio' => '   ', 'city' => ''])
        ->assertSessionHasNoErrors();

    $customer->refresh();

    expect($customer->bio)->toBeNull()
        ->and($customer->city)->toBeNull();
});

test('the bio and city have length limits', function () {
    $customer = piCustomer();

    $this->actingAs($customer)
        ->put(route('customer.profile.update'), [
            'bio' => str_repeat('a', 501),
            'city' => str_repeat('b', 101),
        ])
        ->assertSessionHasErrors(['bio', 'city']);

    expect($customer->refresh()->bio)->toBeNull();
});

test('saving the public info leaves the account details alone', function () {
    $customer = piCustomer();
    $email = $customer->email;

    $this->actingAs($customer)
        ->put(route('customer.profile.update'), ['bio' => 'Hi', 'city' => 'Sousse', 'email' => 'other@example.com', 'role' => 'admin']);

    $customer->refresh();

    expect($customer->email)->toBe($email)
        ->and($customer->role)->toBe('customer');
});

test('only customers have a public profile to fill in', function () {
    $technician = piTechnician();

    $this->actingAs($technician)
        ->put(route('customer.profile.update'), ['bio' => 'Hi'])
        ->assertForbidden();

    expect($technician->refresh()->bio)->toBeNull();
});

test('guests cannot fill in a public profile', function () {
    $this->put(route('customer.profile.update'), ['bio' => 'Hi'])->assertRedirect(route('login'));
});

test('the profile page offers the public info form to customers only', function () {
    $this->withoutVite();

    $customer = piCustomer();
    $customer->forceFill(['bio' => 'Hello', 'city' => 'Tunis'])->save();

    $this->actingAs($customer)
        ->get(route('customer.profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Customers/EditProfile')
            ->where('profile.bio', 'Hello')
            ->where('profile.city', 'Tunis')
            ->where('profile.bio_max', 500)
            ->where('profile.city_max', 100));

    $this->actingAs(piTechnician())->get(route('customer.profile.edit'))->assertForbidden();
    $this->actingAs(User::factory()->create(['role' => 'admin']))->get(route('customer.profile.edit'))->assertForbidden();
});

test('guests cannot open the profile page', function () {
    $this->get(route('customer.profile.edit'))->assertRedirect(route('login'));
});

test('the account page no longer carries the public info form', function () {
    $this->withoutVite();

    $this->actingAs(piCustomer())
        ->get(route('profile.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->missing('publicInfo'));
});

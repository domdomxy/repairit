<?php

use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function scopeTechnician(string $name, array $profile = [], array $user = []): User
{
    $technician = User::factory()->create(['name' => $name, 'role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function scopeCustomer(string $name, array $user = []): User
{
    return User::factory()->create(['name' => $name, 'role' => 'customer', ...$user]);
}

/** The names the page lists, in order, for a search made by $viewer. */
function scopeNames($test, User $viewer, array $query = []): array
{
    $names = [];

    $test->actingAs($viewer)
        ->get(route('technicians.index', $query))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$names) {
            $names = collect($page->toArray()['props']['technicians']['data'])->pluck('name')->all();
        });

    return $names;
}

test('the search looks for technicians only unless told otherwise', function () {
    $viewer = scopeCustomer('Viewer');
    scopeTechnician('Tina Technician');
    scopeCustomer('Carl Customer');

    expect(scopeNames($this, $viewer))->toBe(['Tina Technician'])
        ->and(scopeNames($this, $viewer, ['type' => 'technician']))->toBe(['Tina Technician'])
        ->and(scopeNames($this, $viewer, ['type' => 'nonsense']))->toBe(['Tina Technician']);
});

test('customers can be searched on their own', function () {
    $viewer = scopeCustomer('Viewer');
    scopeTechnician('Tina Technician');
    scopeCustomer('Carl Customer');
    scopeCustomer('Cora Customer');

    expect(scopeNames($this, $viewer, ['type' => 'customer']))->toBe(['Carl Customer', 'Cora Customer'])
        ->and(scopeNames($this, $viewer, ['type' => 'customer', 'name' => 'cora']))->toBe(['Cora Customer']);
});

test('searching everyone lists technicians first, then customers', function () {
    $viewer = scopeCustomer('Viewer');
    scopeTechnician('Low Rated', ['rating_avg' => 3.0, 'rating_count' => 2]);
    scopeTechnician('High Rated', ['rating_avg' => 4.9, 'rating_count' => 8]);
    scopeCustomer('Carl Customer');
    scopeCustomer('Anna Customer');

    expect(scopeNames($this, $viewer, ['type' => 'all']))
        ->toBe(['High Rated', 'Low Rated', 'Anna Customer', 'Carl Customer']);
});

test('the name matches both technicians and customers when searching everyone', function () {
    $viewer = scopeCustomer('Viewer');
    scopeTechnician('Sami Technician');
    scopeCustomer('Sami Customer');
    scopeCustomer('Someone Else');

    expect(scopeNames($this, $viewer, ['type' => 'all', 'name' => 'sami']))
        ->toBe(['Sami Technician', 'Sami Customer']);
});

test('you never find yourself among the customers, nor admins or suspended accounts', function () {
    $viewer = scopeCustomer('Viewer Customer');
    scopeCustomer('Other Customer');
    scopeCustomer('Suspended Customer', ['suspended_at' => now()]);
    User::factory()->create(['name' => 'Admin Person', 'role' => 'admin']);
    scopeTechnician('Suspended Technician', [], ['suspended_at' => now()]);

    expect(scopeNames($this, $viewer, ['type' => 'customer']))->toBe(['Other Customer'])
        ->and(scopeNames($this, $viewer, ['type' => 'all']))->toBe(['Other Customer']);
});

test('a customer result carries only a name and a picture', function () {
    $viewer = scopeCustomer('Viewer');
    scopeCustomer('Carl Customer', ['email' => 'carl.private@example.com']);

    $props = $this->actingAs($viewer)
        ->get(route('technicians.index', ['type' => 'customer']))
        ->viewData('page')['props'];

    expect($props['technicians']['data'][0])->toHaveKeys(['id', 'name', 'avatar_url', 'role'])
        ->and($props['technicians']['data'][0]['role'])->toBe('customer')
        ->and($props['technicians']['data'][0]['technician_profile'])->toBeNull()
        ->and(json_encode($props))->not->toContain('carl.private@example.com');
});

test('the technician filters do not apply to a search for customers, and there is no map', function () {
    $viewer = scopeCustomer('Viewer');
    scopeCustomer('Carl Customer');
    scopeTechnician('Tina', ['latitude' => 36.8, 'longitude' => 10.18]);

    $this->actingAs($viewer)
        ->get(route('technicians.index', ['type' => 'customer', 'category' => 'plumbing', 'availability' => 'busy']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 1)
            ->where('technicians.data.0.name', 'Carl Customer')
            ->has('mapPoints', 0));
});

test('the chosen scope is kept in the filters and in the pagination links', function () {
    $viewer = scopeCustomer('Viewer');

    foreach (range(1, 14) as $i) {
        scopeCustomer("Customer {$i}");
    }

    $this->actingAs($viewer)
        ->get(route('technicians.index', ['type' => 'customer']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.type', 'customer')
            ->has('technicians.data', 12)
            ->where('technicians.next_page_url', fn ($url) => str_contains($url, 'type=customer')));
});

test('technician cards say they are technicians', function () {
    $viewer = scopeCustomer('Viewer');
    scopeTechnician('Tina');

    $this->actingAs($viewer)
        ->get(route('technicians.index'))
        ->assertInertia(fn (Assert $page) => $page->where('technicians.data.0.role', 'technician'));
});

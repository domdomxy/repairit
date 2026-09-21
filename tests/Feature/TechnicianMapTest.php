<?php

use App\Models\Category;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function mapTechnician(array $profile = [], array $user = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function mapViewer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

test('technicians with a location are on the search map, rounded to about a kilometre', function () {
    $this->withoutVite();
    $technician = mapTechnician(
        ['latitude' => 36.8065432, 'longitude' => 10.1815321, 'city' => 'Tunis', 'availability_status' => 'busy'],
        ['name' => 'Sami'],
    );

    $this->actingAs(mapViewer())
        ->get(route('search.index', ['type' => 'technicians', 'availability' => 'busy']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('mapPoints', 1)
            ->where('mapPoints.0.id', $technician->id)
            ->where('mapPoints.0.name', 'Sami')
            ->where('mapPoints.0.lat', 36.81)
            ->where('mapPoints.0.lng', 10.18)
            ->where('mapPoints.0.city', 'Tunis')
            ->where('mapPoints.0.availability_status', 'busy'));
});

test('a map point carries no contact details and no exact coordinates', function () {
    $this->withoutVite();
    mapTechnician([
        'latitude' => 36.8065432,
        'longitude' => 10.1815321,
        'phone' => '+216 12 345 678',
        'address' => '12 Rue Secrete',
        'show_phone_publicly' => true,
        'show_email_publicly' => true,
    ], ['email' => 'secret-sami@example.com']);

    $response = $this->actingAs(mapViewer())->get(route('search.index', ['type' => 'technicians', 'availability' => 'available']));

    $response->assertInertia(fn (Assert $page) => $page
        ->missing('mapPoints.0.email')
        ->missing('mapPoints.0.phone')
        ->missing('mapPoints.0.address')
        ->missing('mapPoints.0.latitude')
        ->missing('mapPoints.0.longitude'));

    $body = $response->getContent();

    expect($body)->not->toContain('36.8065432')
        ->and($body)->not->toContain('10.1815321')
        ->and($body)->not->toContain('12 Rue Secrete')
        ->and($body)->not->toContain('+216 12 345 678')
        ->and($body)->not->toContain('secret-sami@example.com');
});

test('technicians without a location, or suspended, are not on the map', function () {
    $this->withoutVite();
    mapTechnician(['latitude' => 36.8, 'longitude' => 10.18]);
    mapTechnician();
    mapTechnician(['latitude' => 35.8, 'longitude' => 10.6], ['suspended_at' => now()]);

    $this->actingAs(mapViewer())
        ->get(route('search.index', ['type' => 'technicians', 'availability' => 'available']))
        ->assertInertia(fn (Assert $page) => $page->has('mapPoints', 1));
});

test('the map shows every match, not just the current page of results', function () {
    $this->withoutVite();

    foreach (range(1, 15) as $i) {
        mapTechnician(['latitude' => 36 + $i / 10, 'longitude' => 10]);
    }

    $this->actingAs(mapViewer())
        ->get(route('search.index', ['type' => 'technicians', 'availability' => 'available']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 12)
            ->has('mapPoints', 15));
});

test('the map follows the search filters', function () {
    $this->withoutVite();
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $electrical = Category::create(['name' => 'Electrical', 'slug' => 'electrical']);
    $plumber = mapTechnician(['latitude' => 36.8, 'longitude' => 10.18], ['name' => 'Plumber']);
    $electrician = mapTechnician(['latitude' => 35.8, 'longitude' => 10.6], ['name' => 'Electrician']);
    $plumber->technicianProfile->categories()->attach($plumbing);
    $electrician->technicianProfile->categories()->attach($electrical);

    $viewer = mapViewer();

    $this->actingAs($viewer)
        ->get(route('search.index', ['type' => 'technicians', 'category' => 'plumbing']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('mapPoints', 1)
            ->where('mapPoints.0.name', 'Plumber'));

    $this->actingAs($viewer)
        ->get(route('search.index', ['type' => 'technicians', 'q' => 'Electri']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('mapPoints', 1)
            ->where('mapPoints.0.name', 'Electrician'));
});

test('the map respects the radius of a location search', function () {
    $this->withoutVite();
    mapTechnician(['latitude' => 36.81, 'longitude' => 10.18], ['name' => 'Near']);
    mapTechnician(['latitude' => 33.88, 'longitude' => 10.86], ['name' => 'Far']);

    $this->actingAs(mapViewer())
        ->get(route('search.index', ['type' => 'technicians', 'lat' => 36.8, 'lng' => 10.18, 'radius' => 20, 'sort' => 'distance']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('mapPoints', 1)
            ->where('mapPoints.0.name', 'Near')
            ->has('technicians.data', 1));
});

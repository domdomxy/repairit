<?php

use App\Models\Category;
use App\Models\Offer;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Models\UserRelation;
use Inertia\Testing\AssertableInertia as Assert;

// The compiled assets are not what is being tested here.
beforeEach(fn () => $this->withoutVite());

function searchTechnician(string $name, array $profile = [], array $user = []): User
{
    $technician = User::factory()->create(['name' => $name, 'role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, 'city' => 'Tunis', ...$profile]);

    return $technician;
}

function searchCustomer(string $name, array $user = []): User
{
    return User::factory()->create(['name' => $name, 'role' => 'customer', ...$user]);
}

function searchOffer(User $technician, string $title, array $attributes = []): Offer
{
    return Offer::create(['technician_id' => $technician->id, 'title' => $title, ...$attributes]);
}

function searchRequest(User $customer, string $description, array $attributes = []): ServiceRequest
{
    return $customer->serviceRequests()->create(['description' => $description, 'city' => 'Tunis', ...$attributes]);
}

/**
 * The props of the search page for a search made by $viewer. The page lists
 * nothing until there is something to search for, so a search with no words or
 * filters of its own is made in the city everything here is in.
 */
function searchProps($test, User $viewer, array $query = []): array
{
    if (! array_intersect_key($query, array_flip(['q', 'category', 'city', 'availability', 'favorites', 'lat']))) {
        $query += ['city' => 'Tunis'];
    }

    return $test->actingAs($viewer)
        ->get(route('search.index', $query))
        ->assertOk()
        ->viewData('page')['props'];
}

test('guests are sent to log in', function () {
    $this->get(route('search.index'))->assertRedirect(route('login'));
});

test('the search looks for technicians, offers and requests together unless told otherwise', function () {
    $viewer = searchCustomer('Viewer');
    $tina = searchTechnician('Tina Technician');
    searchOffer($tina, 'Boiler service');
    searchRequest(searchCustomer('Carl Customer'), 'My sink leaks');

    $props = searchProps($this, $viewer);

    expect($props['technicians']['data'])->toHaveCount(1)
        ->and($props['offers']['data'])->toHaveCount(1)
        ->and($props['requests']['data'])->toHaveCount(1)
        ->and($props['counts'])->toBe(['technicians' => 1, 'offers' => 1, 'requests' => 1]);

    // An unknown kind falls back to everything.
    expect(searchProps($this, $viewer, ['type' => 'nonsense'])['counts'])->toBe(['technicians' => 1, 'offers' => 1, 'requests' => 1]);
});

test('one kind can be searched on its own, and the tabs still know how many the others have', function () {
    $viewer = searchCustomer('Viewer');
    $tina = searchTechnician('Tina Technician');
    searchOffer($tina, 'Boiler service');
    searchOffer($tina, 'Screen repair');
    searchRequest(searchCustomer('Carl Customer'), 'My sink leaks');

    $technicians = searchProps($this, $viewer, ['type' => 'technicians']);
    $offers = searchProps($this, $viewer, ['type' => 'offers']);
    $requests = searchProps($this, $viewer, ['type' => 'requests']);

    expect($technicians['technicians']['data'])->toHaveCount(1)
        ->and($technicians['offers'])->toBeNull()
        ->and($technicians['requests'])->toBeNull()
        ->and($technicians['counts'])->toBe(['technicians' => 1, 'offers' => 2, 'requests' => 1])
        ->and($offers['offers']['data'])->toHaveCount(2)
        ->and($offers['technicians'])->toBeNull()
        ->and($requests['requests']['data'])->toHaveCount(1)
        ->and($requests['counts'])->toBe(['technicians' => 1, 'offers' => 2, 'requests' => 1]);
});

test('the old technician kind is still understood', function () {
    $viewer = searchCustomer('Viewer');
    searchTechnician('Tina Technician');
    searchOffer(searchTechnician('Omar'), 'Boiler service');

    $props = searchProps($this, $viewer, ['type' => 'technician']);

    expect($props['technicians']['data'])->toHaveCount(2)
        ->and($props['offers'])->toBeNull()
        ->and($props['filters']->type)->toBe('technicians');
});

test('customers cannot be searched: not by name, not as a kind, and never with a card of their own', function () {
    $viewer = searchCustomer('Viewer');
    $carl = searchCustomer('Carl Customer', ['email' => 'carl.private@example.com']);
    searchRequest($carl, 'My sink leaks');
    searchTechnician('Tina Technician');

    // The name of the person behind a request matches nothing.
    $props = searchProps($this, $viewer, ['q' => 'Carl']);

    expect($props['technicians']['data'])->toBeEmpty()
        ->and($props['offers']['data'])->toBeEmpty()
        ->and($props['requests']['data'])->toBeEmpty()
        ->and($props['counts'])->toBe(['technicians' => 0, 'offers' => 0, 'requests' => 0]);

    // "customer" is not a kind any more: it reads as everything, technicians and posts only.
    $props = searchProps($this, $viewer, ['type' => 'customer']);

    expect($props['technicians']['data'])->toHaveCount(1)
        ->and(collect($props['technicians']['data'])->pluck('role')->unique()->all())->toBe(['technician'])
        ->and(json_encode($props))->not->toContain('carl.private@example.com');
});

test('a request result carries what the request says and only a name and a picture of its author', function () {
    $viewer = searchCustomer('Viewer');
    $carl = searchCustomer('Carl Customer', ['email' => 'carl.private@example.com']);
    searchRequest($carl, 'My sink leaks', ['budget' => '50 TND']);

    $props = searchProps($this, $viewer, ['type' => 'requests']);
    $card = $props['requests']['data'][0];

    expect($card)->toHaveKeys(['id', 'description', 'city', 'budget', 'created_at', 'quotes_count', 'categories', 'media', 'customer'])
        ->and(array_keys($card['customer']))->toEqualCanonicalizing(['id', 'name', 'avatar_url', 'role'])
        ->and(json_encode($props))->not->toContain('carl.private@example.com');
});

test('the words typed match a technician\'s name, an offer\'s text and a request\'s description', function () {
    $viewer = searchCustomer('Viewer');
    $sami = searchTechnician('Sami Plumber');
    $omar = searchTechnician('Omar Electrician');
    searchOffer($sami, 'Pipe repair', ['description' => 'Leaks fixed fast']);
    searchOffer($omar, 'Wiring check');
    searchRequest(searchCustomer('Carl'), 'The pipe under my sink leaks');
    searchRequest(searchCustomer('Cora'), 'My screen is cracked');

    $byPipe = searchProps($this, $viewer, ['q' => 'pipe']);

    expect(collect($byPipe['offers']['data'])->pluck('title')->all())->toBe(['Pipe repair'])
        ->and(collect($byPipe['requests']['data'])->pluck('description')->all())->toBe(['The pipe under my sink leaks'])
        ->and($byPipe['technicians']['data'])->toBeEmpty();

    // A technician's name finds the technician and their offers.
    $bySami = searchProps($this, $viewer, ['q' => 'sami']);

    expect(collect($bySami['technicians']['data'])->pluck('name')->all())->toBe(['Sami Plumber'])
        ->and(collect($bySami['offers']['data'])->pluck('title')->all())->toBe(['Pipe repair']);
});

test('the words typed are matched literally, wildcards included', function () {
    $viewer = searchCustomer('Viewer');
    searchTechnician('100% Fixed');
    searchTechnician('Plain Name');

    $props = searchProps($this, $viewer, ['type' => 'technicians', 'q' => '%']);

    expect(collect($props['technicians']['data'])->pluck('name')->all())->toBe(['100% Fixed']);
});

test('a value that is not plain text reads as no filter instead of an error', function () {
    $viewer = searchCustomer('Viewer');
    searchTechnician('Tina');

    $this->actingAs($viewer)->get('/search?q[]=x&city[]=y&category[]=z&type[]=offers&availability=available')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('technicians.data', 1));
});

test('the category and the city narrow every kind', function () {
    $viewer = searchCustomer('Viewer');
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $electrical = Category::create(['name' => 'Electrical', 'slug' => 'electrical']);

    $plumber = searchTechnician('Plumber', ['city' => 'Tunis']);
    $electrician = searchTechnician('Electrician', ['city' => 'Sfax']);
    $plumber->technicianProfile->categories()->attach($plumbing);
    $electrician->technicianProfile->categories()->attach($electrical);

    searchOffer($plumber, 'Fix a leak')->categories()->attach($plumbing);
    searchOffer($electrician, 'Fix a socket')->categories()->attach($electrical);

    searchRequest(searchCustomer('Carl'), 'Leaking tap', ['city' => 'Tunis'])->categories()->attach($plumbing);
    searchRequest(searchCustomer('Cora'), 'Dead socket', ['city' => 'Sfax'])->categories()->attach($electrical);

    $byCategory = searchProps($this, $viewer, ['category' => 'plumbing']);

    expect(collect($byCategory['technicians']['data'])->pluck('name')->all())->toBe(['Plumber'])
        ->and(collect($byCategory['offers']['data'])->pluck('title')->all())->toBe(['Fix a leak'])
        ->and(collect($byCategory['requests']['data'])->pluck('description')->all())->toBe(['Leaking tap']);

    // The city is a partial match, and reads the technician's city for their offers.
    $byCity = searchProps($this, $viewer, ['city' => 'sfa']);

    expect(collect($byCity['technicians']['data'])->pluck('name')->all())->toBe(['Electrician'])
        ->and(collect($byCity['offers']['data'])->pluck('title')->all())->toBe(['Fix a socket'])
        ->and(collect($byCity['requests']['data'])->pluck('description')->all())->toBe(['Dead socket']);
});

test('availability and favorites belong to technicians: they narrow technicians and offers and leave requests out', function () {
    $viewer = searchCustomer('Viewer');
    $free = searchTechnician('Free One', ['availability_status' => 'available']);
    $busy = searchTechnician('Busy One', ['availability_status' => 'busy']);
    searchOffer($free, 'Free offer');
    searchOffer($busy, 'Busy offer');
    searchRequest(searchCustomer('Carl'), 'Leaking tap');

    $available = searchProps($this, $viewer, ['availability' => 'available']);

    expect(collect($available['technicians']['data'])->pluck('name')->all())->toBe(['Free One'])
        ->and(collect($available['offers']['data'])->pluck('title')->all())->toBe(['Free offer'])
        ->and($available['requests']['data'])->toBeEmpty()
        ->and($available['counts']['requests'])->toBe(0);

    UserRelation::create(['user_id' => $viewer->id, 'target_id' => $busy->id, 'type' => UserRelation::FAVORITE]);

    $favorites = searchProps($this, $viewer, ['favorites' => 1]);

    expect(collect($favorites['technicians']['data'])->pluck('name')->all())->toBe(['Busy One'])
        ->and(collect($favorites['offers']['data'])->pluck('title')->all())->toBe(['Busy offer'])
        ->and($favorites['requests']['data'])->toBeEmpty();
});

test('blocked people, suspended accounts, closed requests and profile-less technicians never show', function () {
    $viewer = searchCustomer('Viewer');

    $blocked = searchTechnician('Blocked One');
    $blocksMe = searchTechnician('Blocks Me');
    $suspended = searchTechnician('Suspended One', [], ['suspended_at' => now()]);
    $visible = searchTechnician('Visible One');
    $withoutProfile = User::factory()->create(['name' => 'No Profile', 'role' => 'technician']);

    foreach ([$blocked, $blocksMe, $suspended, $visible, $withoutProfile] as $technician) {
        searchOffer($technician, "Offer of {$technician->name}");
    }

    UserRelation::create(['user_id' => $viewer->id, 'target_id' => $blocked->id, 'type' => UserRelation::BLOCK]);
    UserRelation::create(['user_id' => $blocksMe->id, 'target_id' => $viewer->id, 'type' => UserRelation::BLOCK]);

    $blockedCustomer = searchCustomer('Blocked Customer');
    UserRelation::create(['user_id' => $viewer->id, 'target_id' => $blockedCustomer->id, 'type' => UserRelation::BLOCK]);

    searchRequest($blockedCustomer, 'From a blocked customer');
    searchRequest(searchCustomer('Suspended Customer', ['suspended_at' => now()]), 'From a suspended customer');
    searchRequest(searchCustomer('Closing Customer'), 'A closed one', ['status' => ServiceRequest::STATUS_CLOSED]);
    searchRequest(searchCustomer('Open Customer'), 'An open one');

    $props = searchProps($this, $viewer);

    expect(collect($props['technicians']['data'])->pluck('name')->all())->toBe(['Visible One'])
        ->and(collect($props['offers']['data'])->pluck('title')->all())->toBe(['Offer of Visible One'])
        ->and(collect($props['requests']['data'])->pluck('description')->all())->toBe(['An open one']);
});

test('technicians are best rated first, offers newest first or by their technician\'s rating, requests newest first', function () {
    $viewer = searchCustomer('Viewer');
    $low = searchTechnician('Low Rated', ['rating_avg' => 3.0, 'rating_count' => 2]);
    $high = searchTechnician('High Rated', ['rating_avg' => 4.9, 'rating_count' => 8]);

    $lowOffer = searchOffer($low, 'Low offer');
    $highOffer = searchOffer($high, 'High offer');
    $lowOffer->forceFill(['created_at' => now()->addMinute()])->save();

    $old = searchRequest(searchCustomer('Carl'), 'Old request');
    $old->forceFill(['created_at' => now()->subDay()])->save();
    searchRequest(searchCustomer('Cora'), 'New request');

    $props = searchProps($this, $viewer);

    expect(collect($props['technicians']['data'])->pluck('name')->all())->toBe(['High Rated', 'Low Rated'])
        ->and(collect($props['offers']['data'])->pluck('title')->all())->toBe(['Low offer', 'High offer'])
        ->and(collect($props['requests']['data'])->pluck('description')->all())->toBe(['New request', 'Old request']);

    $rated = searchProps($this, $viewer, ['type' => 'offers', 'sort' => 'rating']);

    expect(collect($rated['offers']['data'])->pluck('title')->all())->toBe(['High offer', 'Low offer']);
});

test('"all" is a short preview with the totals, and one kind pages through everything', function () {
    $viewer = searchCustomer('Viewer');

    foreach (range(1, 14) as $i) {
        searchTechnician("Technician {$i}");
    }

    $all = searchProps($this, $viewer);

    expect($all['technicians']['data'])->toHaveCount(8)
        ->and($all['counts']['technicians'])->toBe(14);

    // The preview is always the first page, whatever page is asked for.
    expect(searchProps($this, $viewer, ['page' => 2])['technicians']['data'])->toHaveCount(8);

    $this->actingAs($viewer)
        ->get(route('search.index', ['type' => 'technicians', 'city' => 'Tunis']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 12)
            ->where('technicians.total', 14)
            ->where('technicians.next_page_url', fn ($url) => str_contains($url, 'type=technicians')));

    $this->actingAs($viewer)
        ->get(route('search.index', ['type' => 'technicians', 'city' => 'Tunis', 'page' => 2]))
        ->assertInertia(fn (Assert $page) => $page->has('technicians.data', 2));
});

test('the location tools, the map and the distance belong to the technician search', function () {
    $viewer = searchCustomer('Viewer');
    searchTechnician('Near', ['latitude' => 36.81, 'longitude' => 10.18]);
    searchTechnician('Far', ['latitude' => 33.88, 'longitude' => 10.86]);

    $location = ['lat' => 36.8, 'lng' => 10.18, 'radius' => 20, 'sort' => 'distance', 'city' => 'Tunis'];

    $technicians = searchProps($this, $viewer, ['type' => 'technicians'] + $location);

    expect(collect($technicians['technicians']['data'])->pluck('name')->all())->toBe(['Near'])
        ->and($technicians['technicians']['data'][0])->toHaveKey('distance')
        ->and($technicians['mapPoints'])->toHaveCount(1)
        ->and((array) $technicians['filters'])->toHaveKeys(['lat', 'lng', 'radius']);

    // Elsewhere they are ignored: no distance, no radius, no map, and they are not echoed back.
    foreach (['all', 'offers', 'requests'] as $type) {
        $props = searchProps($this, $viewer, ['type' => $type] + $location);

        expect($props['mapPoints'])->toBe([])
            ->and($props['counts']['technicians'])->toBe(2)
            ->and((array) $props['filters'])->not->toHaveKeys(['lat', 'lng', 'radius']);
    }
});

test('a technician result never carries contact details or exact coordinates', function () {
    $viewer = searchCustomer('Viewer');
    $technician = searchTechnician('Secret Sami', [
        'latitude' => 36.8065432,
        'longitude' => 10.1815321,
        'phone' => '+216 12 345 678',
        'address' => '12 Rue Secrete',
        'show_phone_publicly' => true,
        'show_email_publicly' => true,
    ], ['email' => 'secret-sami@example.com']);
    searchOffer($technician, 'Boiler service');

    foreach (['all', 'technicians', 'offers'] as $type) {
        $body = $this->actingAs($viewer)->get(route('search.index', ['type' => $type]))->getContent();

        expect($body)->not->toContain('secret-sami@example.com')
            ->and($body)->not->toContain('+216 12 345 678')
            ->and($body)->not->toContain('12 Rue Secrete')
            ->and($body)->not->toContain('36.8065432')
            ->and($body)->not->toContain('10.1815321');
    }
});

test('a request tells a technician whether they already sent a quote', function () {
    $technician = searchTechnician('Tina');
    $customer = searchCustomer('Carl');
    $answered = searchRequest($customer, 'Answered');
    searchRequest($customer, 'Not answered yet');

    $answered->quotes()->create(['technician_id' => $technician->id, 'price' => '40 TND', 'estimated_time' => '1 day', 'message' => 'Hello']);

    $rows = collect(searchProps($this, $technician, ['type' => 'requests'])['requests']['data'])->keyBy('description');

    expect($rows['Answered']['has_my_quote'])->toBeTrue()
        ->and($rows['Not answered yet']['has_my_quote'])->toBeFalse();
});

test('the old technicians address sends people to the search, keeping what they had chosen', function () {
    $viewer = searchCustomer('Viewer');

    // The old page looked for technicians unless told otherwise, by `name`.
    $this->actingAs($viewer)->get('/technicians')
        ->assertRedirect(route('search.index', ['type' => 'technicians']));

    $this->actingAs($viewer)->get('/technicians?name=sami&category=plumbing')
        ->assertRedirect(route('search.index', ['category' => 'plumbing', 'type' => 'technicians', 'q' => 'sami']));

    // Looking for everyone meant everything; customers are no longer a kind of their own.
    $this->actingAs($viewer)->get('/technicians?type=all')
        ->assertRedirect(route('search.index', ['type' => 'all']));

    $this->actingAs($viewer)->get('/technicians?type=customer')
        ->assertRedirect(route('search.index', ['type' => 'all']));
});

test('with no filters set, the page still gets them as an object', function () {
    $viewer = searchCustomer('Viewer');

    expect($this->actingAs($viewer)->get(route('search.index'))->assertOk()->getContent())
        ->toContain('&quot;filters&quot;:{}');
});

test('with nothing to search for the page lists nothing, whatever the kind picked', function () {
    $viewer = searchCustomer('Viewer');
    searchOffer(searchTechnician('Tina', ['latitude' => 36.8, 'longitude' => 10.18]), 'Boiler service');
    searchRequest(searchCustomer('Carl'), 'My sink leaks');

    foreach (['all', 'technicians', 'offers', 'requests'] as $type) {
        $props = $this->actingAs($viewer)->get(route('search.index', ['type' => $type, 'sort' => 'distance']))
            ->assertOk()
            ->viewData('page')['props'];

        expect($props['searching'])->toBeFalse()
            ->and($props['counts'])->toBe(['technicians' => 0, 'offers' => 0, 'requests' => 0])
            ->and($props['mapPoints'])->toBe([]);

        foreach (['technicians', 'offers', 'requests'] as $kind) {
            expect($props[$kind] === null || $props[$kind]['data'] === [])->toBeTrue();
        }
    }

    // Blank words are nothing to search for either.
    $blank = $this->actingAs($viewer)->get(route('search.index', ['q' => '   ', 'city' => '']))->viewData('page')['props'];

    expect($blank['searching'])->toBeFalse()
        ->and($blank['counts'])->toBe(['technicians' => 0, 'offers' => 0, 'requests' => 0]);
});

test('any one of the words, a category, a city, an availability, favorites or a location is something to search for', function () {
    $viewer = searchCustomer('Viewer');
    searchTechnician('Tina', ['latitude' => 36.8, 'longitude' => 10.18]);

    foreach ([
        ['q' => 'Tina'],
        ['category' => 'plumbing'],
        ['city' => 'Tunis'],
        ['availability' => 'available'],
        ['favorites' => 1],
        ['type' => 'technicians', 'lat' => 36.8, 'lng' => 10.18],
    ] as $query) {
        expect(searchProps($this, $viewer, $query)['searching'])->toBeTrue();
    }

    // A location only counts for the technician search, where it is used.
    expect(searchProps($this, $viewer, ['type' => 'offers', 'lat' => 36.8, 'lng' => 10.18])['searching'])->toBeFalse();
});

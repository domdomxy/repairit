<?php

use App\Models\Category;
use App\Models\Offer;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function browseTechnician(array $user = [], array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function browseOffer(User $technician, string $title, array $attributes = [], array $mimes = []): Offer
{
    $offer = Offer::create(['technician_id' => $technician->id, 'title' => $title, ...$attributes]);

    foreach ($mimes as $i => $mime) {
        $offer->media()->create(['path' => "offer-media/x/{$offer->id}-{$i}", 'name' => "f{$i}", 'mime' => $mime, 'size' => 10]);
    }

    return $offer;
}

/** The titles the page lists, in order, for a search. */
function browseTitles($test, array $query = []): array
{
    $titles = [];

    $test->get(route('feed.index', $query))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$titles) {
            $page->component('Feed/Index');
            $titles = collect($page->toArray()['props']['feed']['data'])->pluck('title')->all();
        });

    return $titles;
}

test('guests are sent to log in', function () {
    $this->get(route('feed.index'))->assertRedirect(route('login'));
});

test('any signed-in user sees every technician\'s offers, newest first', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $a = browseTechnician();
    $b = browseTechnician();

    $first = browseOffer($a, 'Boiler service');
    $second = browseOffer($b, 'Screen repair');
    $second->forceFill(['created_at' => now()->addMinute()])->save();

    expect(browseTitles($this->actingAs($viewer)))->toBe(['Screen repair', 'Boiler service'])
        ->and(browseTitles($this->actingAs($viewer), ['sort' => 'oldest']))->toBe(['Boiler service', 'Screen repair']);
});

test('offers of suspended technicians are not listed', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    browseOffer(browseTechnician(), 'Visible');
    browseOffer(browseTechnician(['suspended_at' => now()]), 'Hidden');

    expect(browseTitles($this->actingAs($viewer)))->toBe(['Visible']);
});

test('the technician card never carries private contact data', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $technician = browseTechnician(['email' => 'secret@example.com'], [
        'phone' => '99 999 999',
        'address' => '1 Private Street',
        'city' => 'Tunis',
        'latitude' => 36.8065,
        'longitude' => 10.1815,
        'show_phone_publicly' => true,
        'show_email_publicly' => true,
    ]);
    browseOffer($technician, 'Boiler service');

    $response = $this->actingAs($viewer)->get(route('feed.index'))->assertOk();
    $json = json_encode($response->viewData('page')['props']['feed']);

    expect($json)->toContain('Tunis')
        ->not->toContain('secret@example.com')
        ->not->toContain('99 999 999')
        ->not->toContain('Private Street')
        ->not->toContain('36.8065');
});

test('free text matches the title, the description and the technician\'s name', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $sam = browseTechnician(['name' => 'Samir Ben Ali']);
    browseOffer($sam, 'Boiler service', ['description' => 'Full check and clean.']);
    browseOffer($sam, 'Screen repair', ['description' => 'Cracked glass replaced.']);
    browseOffer(browseTechnician(['name' => 'Leila']), 'Laptop cleaning');

    $this->actingAs($viewer);

    expect(browseTitles($this, ['q' => 'boiler']))->toBe(['Boiler service'])
        ->and(browseTitles($this, ['q' => 'cracked']))->toBe(['Screen repair'])
        ->and(browseTitles($this, ['q' => 'samir']))->toHaveCount(2)
        ->and(browseTitles($this, ['q' => 'nothing like this']))->toBe([]);
});

test('wildcard characters in the search are matched literally', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $technician = browseTechnician();
    browseOffer($technician, '100% fixed price');
    browseOffer($technician, 'Boiler service');

    $this->actingAs($viewer);

    expect(browseTitles($this, ['q' => '100%']))->toBe(['100% fixed price'])
        ->and(browseTitles($this, ['q' => '_']))->toBe([]);
});

test('offers can be filtered by their category tags, and by the availability and city of the technician', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $phones = Category::create(['name' => 'Phones', 'slug' => 'phones']);

    $plumber = browseTechnician([], ['city' => 'Tunis', 'availability_status' => 'available']);
    $phoneFixer = browseTechnician([], ['city' => 'Sfax', 'availability_status' => 'busy']);

    browseOffer($plumber, 'Pipe repair')->categories()->attach($plumbing);
    browseOffer($phoneFixer, 'Screen repair')->categories()->attach([$phones->id, $plumbing->id]);
    // What the technician works in doesn't matter: only the offer's own tags do.
    $phoneFixer->technicianProfile->categories()->attach($phones);
    browseOffer($phoneFixer, 'Untagged offer');

    $this->actingAs($viewer);

    expect(browseTitles($this, ['category' => 'plumbing']))->toEqualCanonicalizing(['Pipe repair', 'Screen repair'])
        ->and(browseTitles($this, ['category' => 'phones']))->toBe(['Screen repair'])
        ->and(browseTitles($this, ['availability' => 'busy']))->toEqualCanonicalizing(['Screen repair', 'Untagged offer'])
        ->and(browseTitles($this, ['city' => 'tun']))->toBe(['Pipe repair'])
        ->and(browseTitles($this, ['category' => 'plumbing', 'city' => 'Sfax']))->toBe(['Screen repair']);
});

test('offers can be limited to those with pictures or videos', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $technician = browseTechnician();
    browseOffer($technician, 'Plain');
    browseOffer($technician, 'With picture', mimes: ['image/jpeg']);
    browseOffer($technician, 'With video', mimes: ['video/mp4']);
    browseOffer($technician, 'With both', mimes: ['image/png', 'video/webm']);

    $this->actingAs($viewer);

    expect(browseTitles($this, ['media' => 'any']))->toHaveCount(3)->not->toContain('Plain')
        ->and(browseTitles($this, ['media' => 'image']))->toEqualCanonicalizing(['With picture', 'With both'])
        ->and(browseTitles($this, ['media' => 'video']))->toEqualCanonicalizing(['With video', 'With both']);
});

test('offers can be sorted by the technician\'s rating', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $low = browseTechnician([], ['rating_avg' => 3.0, 'rating_count' => 4]);
    $high = browseTechnician([], ['rating_avg' => 4.8, 'rating_count' => 10]);

    browseOffer($high, 'Top rated');
    browseOffer($low, 'Lower rated')->forceFill(['created_at' => now()->addMinute()])->save();

    $this->actingAs($viewer);

    expect(browseTitles($this))->toBe(['Lower rated', 'Top rated'])
        ->and(browseTitles($this, ['sort' => 'rating']))->toBe(['Top rated', 'Lower rated']);
});

test('the list is paginated and keeps the filters', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    $technician = browseTechnician();

    foreach (range(1, 15) as $i) {
        browseOffer($technician, "Boiler {$i}");
    }

    $this->actingAs($viewer)
        ->get(route('feed.index', ['q' => 'boiler']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('feed.data', 12)
            ->where('feed.total', 15)
            ->where('feed.next_page_url', fn ($url) => str_contains($url, 'q=boiler')));
});

test('with no filters set, they still reach the page as an object', function () {
    $viewer = User::factory()->create(['role' => 'customer']);

    // An empty PHP array would arrive as a JS array, where `filters.sort` is
    // Array.prototype.sort rather than "unset". A full page load carries the
    // props in an HTML attribute, so the quotes are escaped.
    foreach (['feed.index', 'technicians.index'] as $route) {
        expect($this->actingAs($viewer)->get(route($route))->assertOk()->getContent())
            ->toContain('&quot;filters&quot;:{}');
    }
});

test('the top rated list is ranked, limited, and leaves out unrated and suspended technicians', function () {
    $viewer = User::factory()->create(['role' => 'customer']);

    // Seven rated technicians (4.0 ... 4.6), plus one unrated and one suspended with the best score.
    foreach (range(0, 6) as $i) {
        browseTechnician(['name' => "Rated {$i}"], ['rating_avg' => 4.0 + $i / 10, 'rating_count' => 3]);
    }
    browseTechnician(['name' => 'Unrated'], ['rating_avg' => 0, 'rating_count' => 0]);
    browseTechnician(['name' => 'Suspended', 'suspended_at' => now()], ['rating_avg' => 5.0, 'rating_count' => 50]);
    // Same average as "Rated 6", but more reviews: ranks first.
    browseTechnician(['name' => 'Well reviewed'], ['rating_avg' => 4.6, 'rating_count' => 9]);

    $this->actingAs($viewer)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('topRated', 5)
            ->where('topRated.0.name', 'Well reviewed')
            ->where('topRated.1.name', 'Rated 6')
            ->where('topRated.4.name', 'Rated 3'));
});

test('the top rated list carries only public fields', function () {
    $viewer = User::factory()->create(['role' => 'customer']);
    browseTechnician(['email' => 'secret@example.com'], [
        'phone' => '99 999 999',
        'address' => '1 Private Street',
        'latitude' => 36.8065,
        'rating_avg' => 4.5,
        'rating_count' => 2,
    ]);

    $json = json_encode($this->actingAs($viewer)->get(route('feed.index'))->viewData('page')['props']['topRated']);

    expect($json)->not->toContain('secret@example.com')
        ->not->toContain('99 999 999')
        ->not->toContain('Private Street')
        ->not->toContain('36.8065');
});

test('the feed is the main page: the root sends signed-in users there, guests keep the welcome page', function () {
    $this->get('/')->assertOk();

    $this->actingAs(User::factory()->create(['role' => 'customer']))
        ->get('/')
        ->assertRedirect(route('feed.index'));
});

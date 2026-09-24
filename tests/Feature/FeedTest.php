<?php

use App\Models\Category;
use App\Models\Offer;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Models\UserRelation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function feedCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function feedTechnician(array $user = [], array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function feedOffer(User $technician, string $title, array $attributes = []): Offer
{
    return Offer::create(['technician_id' => $technician->id, 'title' => $title, ...$attributes]);
}

/** A request has no title: `$text` is what the customer wrote, and how these tests tell requests apart. */
function feedRequest(User $customer, string $text, array $attributes = []): ServiceRequest
{
    return $customer->serviceRequests()->create([
        'description' => $text,
        ...$attributes,
    ]);
}

function feedAt(Offer|ServiceRequest $post, $when): void
{
    $post->forceFill(['created_at' => $when])->save();
}

/** What the feed lists for a search, in order, as "kind: title" (a request's text for its title). */
function feedPosts($test, array $query = []): array
{
    $posts = [];

    $test->get(route('feed.index', $query))
        ->assertOk()
        ->assertInertia(function (Assert $page) use (&$posts) {
            $page->component('Feed/Index');
            $posts = collect($page->toArray()['props']['feed']['data'])
                ->map(fn ($post) => $post['kind'].': '.($post['title'] ?? $post['description']))
                ->all();
        });

    return $posts;
}

// --- what the feed lists ---------------------------------------------------

test('offers and open requests are listed together, newest first', function () {
    $viewer = feedCustomer();
    $offer = feedOffer(feedTechnician(), 'Boiler service');
    $request = feedRequest(feedCustomer(), 'Cracked screen');
    $older = feedRequest(feedCustomer(), 'Leaking tap');

    feedAt($older, now()->subHour());
    feedAt($offer, now()->subMinutes(30));
    feedAt($request, now());

    $this->actingAs($viewer);

    expect(feedPosts($this))->toBe(['request: Cracked screen', 'offer: Boiler service', 'request: Leaking tap'])
        ->and(feedPosts($this, ['sort' => 'oldest']))->toBe(['request: Leaking tap', 'offer: Boiler service', 'request: Cracked screen']);
});

test('closed requests and requests of suspended customers are not listed', function () {
    $viewer = feedCustomer();
    feedRequest(feedCustomer(), 'Open one');
    feedRequest(feedCustomer(), 'Closed one', ['status' => 'closed']);
    feedRequest(feedCustomer(['suspended_at' => now()]), 'Hidden one');
    feedOffer(feedTechnician(['suspended_at' => now()]), 'Hidden offer');

    expect(feedPosts($this->actingAs($viewer)))->toBe(['request: Open one']);
});

test('an offer and a request with the same id are both listed', function () {
    $viewer = feedCustomer();
    $offer = feedOffer(feedTechnician(), 'Boiler service');
    $request = feedRequest(feedCustomer(), 'Cracked screen');

    expect($offer->id)->toBe($request->id);

    $this->actingAs($viewer)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('feed.data', 2)
            ->where('feed.total', 2));
});

test('the feed is paginated across both kinds and keeps the filters', function () {
    $viewer = feedCustomer();
    $technician = feedTechnician();
    $customer = feedCustomer();

    foreach (range(1, 8) as $i) {
        feedOffer($technician, "Boiler offer {$i}");
        feedRequest($customer, "Boiler request {$i}");
    }

    $this->actingAs($viewer)
        ->get(route('feed.index', ['q' => 'boiler']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('feed.data', 12)
            ->where('feed.total', 16)
            ->where('feed.next_page_url', fn ($url) => str_contains($url, 'q=boiler')));

    $this->actingAs($viewer)
        ->get(route('feed.index', ['q' => 'boiler', 'page' => 2]))
        ->assertInertia(fn (Assert $page) => $page->has('feed.data', 4));
});

test('a request card carries the public fields only', function () {
    $viewer = feedTechnician();
    $customer = feedCustomer(['email' => 'secret@example.com']);
    feedRequest($customer, 'Cracked screen', ['city' => 'Tunis']);

    $response = $this->actingAs($viewer)->get(route('feed.index'))->assertOk();
    $json = json_encode($response->viewData('page')['props']['feed']);

    expect($json)->toContain('Cracked screen')
        ->toContain('Tunis')
        ->not->toContain('secret@example.com');
});

test('a technician sees which requests they already sent a quote to', function () {
    $technician = feedTechnician();
    $customer = feedCustomer();
    $answered = feedRequest($customer, 'Answered');
    feedRequest($customer, 'Waiting');
    $answered->quotes()->create(['technician_id' => $technician->id, 'price' => '80 TND']);

    $this->actingAs($technician)
        ->get(route('feed.index'))
        ->assertInertia(function (Assert $page) {
            $posts = collect($page->toArray()['props']['feed']['data'])->keyBy(fn ($post) => $post['title'] ?? $post['description']);

            expect($posts['Answered']['has_my_quote'])->toBeTrue()
                ->and($posts['Answered']['quotes_count'])->toBe(1)
                ->and($posts['Waiting']['has_my_quote'])->toBeFalse();
        });
});

// --- filters ---------------------------------------------------------------

test('the feed can be filtered to only requests or only offers', function () {
    $viewer = feedCustomer();
    feedOffer(feedTechnician(), 'Boiler service');
    feedRequest(feedCustomer(), 'Cracked screen');

    $this->actingAs($viewer);

    expect(feedPosts($this, ['type' => 'requests']))->toBe(['request: Cracked screen'])
        ->and(feedPosts($this, ['type' => 'offers']))->toBe(['offer: Boiler service'])
        ->and(feedPosts($this, ['type' => 'nonsense']))->toHaveCount(2);
});

test('free text, category and city apply to offers and requests alike', function () {
    $viewer = feedCustomer();
    $phones = Category::create(['name' => 'Phones', 'slug' => 'phones']);
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    $technician = feedTechnician(['name' => 'Samir'], ['city' => 'Sfax']);
    $offer = feedOffer($technician, 'Screen repair', ['description' => 'Cracked glass replaced.']);
    $offer->categories()->sync([$phones->id]);
    feedOffer($technician, 'Pipe fitting')->categories()->sync([$plumbing->id]);

    $customer = feedCustomer();
    feedRequest($customer, 'Broken screen', ['city' => 'Sfax'])->categories()->sync([$phones->id]);
    feedRequest($customer, 'Leaking pipe', ['city' => 'Tunis'])->categories()->sync([$plumbing->id]);

    $this->actingAs($viewer);

    expect(feedPosts($this, ['q' => 'screen']))->toEqualCanonicalizing(['offer: Screen repair', 'request: Broken screen'])
        ->and(feedPosts($this, ['q' => 'cracked']))->toBe(['offer: Screen repair'])
        ->and(feedPosts($this, ['category' => 'plumbing']))->toEqualCanonicalizing(['offer: Pipe fitting', 'request: Leaking pipe'])
        ->and(feedPosts($this, ['city' => 'sfax']))->toEqualCanonicalizing(['offer: Screen repair', 'offer: Pipe fitting', 'request: Broken screen'])
        ->and(feedPosts($this, ['q' => '_']))->toBe([]);
});

test('availability belongs to offers, so it leaves requests out; pictures and videos can be on either', function () {
    $viewer = feedCustomer();
    $available = feedTechnician([], ['availability_status' => 'available']);
    $busy = feedTechnician([], ['availability_status' => 'busy']);
    $withPicture = feedOffer($available, 'With picture');
    $withPicture->media()->create(['path' => 'offer-media/x/1', 'name' => 'a.jpg', 'mime' => 'image/jpeg', 'size' => 10]);
    feedOffer($busy, 'Busy one');
    feedRequest(feedCustomer(), 'Cracked screen');
    $requestWithVideo = feedRequest(feedCustomer(), 'Broken tap, filmed');
    $requestWithVideo->media()->create(['path' => 'request-media/x/1', 'name' => 'tap.mp4', 'mime' => 'video/mp4', 'size' => 10]);

    $this->actingAs($viewer);

    expect(feedPosts($this, ['availability' => 'available']))->toBe(['offer: With picture'])
        ->and(feedPosts($this, ['media' => 'image']))->toBe(['offer: With picture'])
        ->and(feedPosts($this, ['media' => 'video']))->toBe(['request: Broken tap, filmed'])
        ->and(feedPosts($this, ['media' => 'any']))->toEqualCanonicalizing(['offer: With picture', 'request: Broken tap, filmed'])
        // Nothing is both a request and posted by an available technician.
        ->and(feedPosts($this, ['type' => 'requests', 'availability' => 'available']))->toBe([]);
});

test('sorting by rating ranks the offers by their technician, and lists the requests after them', function () {
    $viewer = feedCustomer();
    $good = feedTechnician([], ['rating_avg' => 4.8, 'rating_count' => 5]);
    $unrated = feedTechnician();
    $average = feedTechnician([], ['rating_avg' => 3.5, 'rating_count' => 2]);

    $unratedOffer = feedOffer($unrated, 'Unrated offer');
    $request = feedRequest(feedCustomer(), 'A request');
    feedOffer($average, 'Average offer');
    feedOffer($good, 'Good offer');

    feedAt($unratedOffer, now()->subMinutes(2));
    feedAt($request, now()->subMinute());

    expect(feedPosts($this->actingAs($viewer), ['sort' => 'rating']))
        ->toBe(['offer: Good offer', 'offer: Average offer', 'offer: Unrated offer', 'request: A request']);
});

test('with no filters set, they still reach the page as an object', function () {
    // An empty PHP array would arrive as a JS array, where `filters.sort` is
    // Array.prototype.sort rather than "unset". A full page load carries the
    // props in an HTML attribute, so the quotes are escaped.
    expect($this->actingAs(feedCustomer())->get(route('feed.index'))->assertOk()->getContent())
        ->toContain('&quot;filters&quot;:{}');
});

// --- the filter menu -------------------------------------------------------

test('the filter menu picks requests only, offers only, or the newest of both', function () {
    $viewer = feedCustomer();
    feedOffer(feedTechnician(), 'Boiler service');
    feedRequest(feedCustomer(), 'Cracked screen');

    $this->actingAs($viewer);

    expect(feedPosts($this, ['filter' => 'requests']))->toBe(['request: Cracked screen'])
        ->and(feedPosts($this, ['filter' => 'offers']))->toBe(['offer: Boiler service'])
        ->and(feedPosts($this, ['filter' => 'newest']))->toHaveCount(2)
        ->and(feedPosts($this, ['filter' => 'nonsense']))->toHaveCount(2)
        // The menu wins over the older parameters.
        ->and(feedPosts($this, ['filter' => 'offers', 'type' => 'requests']))->toBe(['offer: Boiler service']);
});

test('"favorites" shows the posts of the people the viewer favorited, offers and requests alike', function () {
    $viewer = feedCustomer();
    $favoriteTechnician = feedTechnician();
    $favoriteCustomer = feedCustomer();

    feedOffer($favoriteTechnician, 'Favorite boilers');
    $otherTechnician = feedTechnician();
    feedOffer($otherTechnician, 'Other boilers');
    feedRequest($favoriteCustomer, 'Favorite screen');
    feedRequest(feedCustomer(), 'Other screen');

    $this->actingAs($viewer);

    // Nobody favorited yet: nothing matches.
    expect(feedPosts($this, ['filter' => 'favorites']))->toBe([]);

    foreach ([$favoriteTechnician, $favoriteCustomer] as $person) {
        UserRelation::create(['user_id' => $viewer->id, 'target_id' => $person->id, 'type' => UserRelation::FAVORITE]);
    }

    // Someone else's favorites are not the viewer's.
    UserRelation::create(['user_id' => feedCustomer()->id, 'target_id' => $otherTechnician->id, 'type' => UserRelation::FAVORITE]);

    expect(feedPosts($this, ['filter' => 'favorites']))->toEqualCanonicalizing(['offer: Favorite boilers', 'request: Favorite screen'])
        ->and(feedPosts($this, ['filter' => 'newest']))->toHaveCount(4);
});

test('"most rated" lists offers only, best rated technician first, and can be narrowed to a category', function () {
    $viewer = feedCustomer();
    $phones = Category::create(['name' => 'Phones', 'slug' => 'phones']);
    $good = feedTechnician([], ['rating_avg' => 4.8, 'rating_count' => 5]);
    $average = feedTechnician([], ['rating_avg' => 3.5, 'rating_count' => 2]);

    feedOffer($average, 'Average phones')->categories()->sync([$phones->id]);
    feedOffer($good, 'Good boilers');
    feedOffer($good, 'Good phones')->categories()->sync([$phones->id]);
    feedRequest(feedCustomer(), 'A request');

    $this->actingAs($viewer);

    expect(feedPosts($this, ['filter' => 'rated']))->toEqualCanonicalizing(['offer: Good boilers', 'offer: Good phones', 'offer: Average phones'])
        ->and(collect(feedPosts($this, ['filter' => 'rated']))->last())->toBe('offer: Average phones')
        ->and(feedPosts($this, ['filter' => 'rated', 'category' => 'phones']))->toBe(['offer: Good phones', 'offer: Average phones']);
});

test('"most relevant" puts posts in the viewer\'s categories first, then their city, then the newest', function () {
    $phones = Category::create(['name' => 'Phones', 'slug' => 'phones']);
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    // A technician who fixes phones, in Sfax.
    $viewer = feedTechnician(['city' => 'Sfax'], ['city' => 'Sfax']);
    $viewer->technicianProfile->categories()->sync([$phones->id]);

    $customer = feedCustomer();
    $newest = feedRequest($customer, 'Newest pipe, elsewhere', ['city' => 'Tunis']);
    $newest->categories()->sync([$plumbing->id]);
    $local = feedRequest($customer, 'Local pipe', ['city' => 'Sfax']);
    $local->categories()->sync([$plumbing->id]);
    $matching = feedRequest($customer, 'Old phone, elsewhere', ['city' => 'Tunis']);
    $matching->categories()->sync([$phones->id]);

    feedAt($matching, now()->subDays(2));
    feedAt($local, now()->subDay());
    feedAt($newest, now());

    $this->actingAs($viewer);

    expect(feedPosts($this, ['filter' => 'relevant']))
        ->toBe(['request: Old phone, elsewhere', 'request: Local pipe', 'request: Newest pipe, elsewhere'])
        ->and(feedPosts($this, ['filter' => 'relevant', 'category' => 'plumbing']))
        ->toBe(['request: Local pipe', 'request: Newest pipe, elsewhere']);
});

test('"most relevant" works for a viewer with no city and no history: it falls back to newest first', function () {
    $viewer = feedCustomer();
    $old = feedRequest(feedCustomer(), 'Old one');
    $new = feedOffer(feedTechnician(), 'New one');

    feedAt($old, now()->subDay());

    expect(feedPosts($this->actingAs($viewer), ['filter' => 'relevant']))->toBe(['offer: New one', 'request: Old one']);
});

// --- who can post what -----------------------------------------------------

test('customers get the new request panel only, technicians both, admins neither', function () {
    $customerProps = $this->actingAs(feedCustomer(['city' => 'Sousse']))->get(route('feed.index'))->viewData('page')['props'];
    $technicianProps = $this->actingAs(feedTechnician())->get(route('feed.index'))->viewData('page')['props'];
    $adminProps = $this->actingAs(User::factory()->create(['role' => 'admin']))->get(route('feed.index'))->viewData('page')['props'];

    expect($customerProps['requestForm']['defaultCity'])->toBe('Sousse')
        ->and($customerProps['requestForm'])->toHaveKeys(['categories', 'limits'])
        ->and($customerProps['offerForm'])->toBeNull()
        ->and($technicianProps['requestForm'])->not->toBeNull()
        ->and($technicianProps['offerForm'])->toHaveKeys(['categories', 'limits'])
        ->and($adminProps['requestForm'])->toBeNull()
        ->and($adminProps['offerForm'])->toBeNull();
});

test('a request posted from the feed sends the person back to the feed', function () {
    $customer = feedCustomer();

    $this->actingAs($customer)
        ->from(route('feed.index', ['type' => 'requests']))
        ->post(route('requests.store'), ['description' => 'Dropped it.', 'from_panel' => true])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('feed.index', ['type' => 'requests']))
        ->assertSessionHas('success');

    expect(ServiceRequest::sole()->customer_id)->toBe($customer->id);
});

test('a request posted from its own form still goes to the request', function () {
    $response = $this->actingAs(feedCustomer())
        ->post(route('requests.store'), ['description' => 'Dropped it.']);

    $response->assertRedirect(route('requests.show', ServiceRequest::sole()));
});

test('the old offers address sends people to the feed, filters included', function () {
    $this->get('/offers')->assertRedirect(route('login'));

    $this->actingAs(feedCustomer())
        ->get('/offers?q=boiler&category=plumbing')
        ->assertRedirect(route('feed.index', ['q' => 'boiler', 'category' => 'plumbing']));
});

test('a request edited from the feed sends the person back to the feed', function () {
    $customer = feedCustomer();
    $serviceRequest = feedRequest($customer, 'Cracked screen');

    $this->actingAs($customer)
        ->from(route('feed.index', ['type' => 'requests']))
        ->put(route('requests.update', $serviceRequest), [
            'description' => 'Cracked screen and dead battery',
            'from_panel' => true,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('feed.index', ['type' => 'requests']))
        ->assertSessionHas('success');

    expect($serviceRequest->refresh()->description)->toBe('Cracked screen and dead battery');
});

test('a request deleted from the feed sends the person back to the feed', function () {
    $customer = feedCustomer();
    $serviceRequest = feedRequest($customer, 'Cracked screen');

    $this->actingAs($customer)
        ->from(route('feed.index'))
        ->delete(route('requests.destroy', ['serviceRequest' => $serviceRequest->id, 'from_panel' => 1]))
        ->assertRedirect(route('feed.index'))
        ->assertSessionHas('success');

    expect(ServiceRequest::count())->toBe(0);
});

test('only the owner can edit or delete a request from the feed', function () {
    $owner = feedCustomer();
    $serviceRequest = feedRequest($owner, 'Cracked screen');
    $stranger = feedTechnician();

    $this->actingAs($stranger)
        ->put(route('requests.update', $serviceRequest), ['description' => 'Hijacked', 'from_panel' => true])
        ->assertForbidden();
    $this->actingAs($stranger)
        ->delete(route('requests.destroy', ['serviceRequest' => $serviceRequest->id, 'from_panel' => 1]))
        ->assertForbidden();

    expect($serviceRequest->refresh()->description)->toBe('Cracked screen');
});

test('a technician can delete their own offer from the feed and stays there', function () {
    $technician = feedTechnician();
    $offer = feedOffer($technician, 'Boiler service');

    $this->actingAs($technician)
        ->from(route('feed.index'))
        ->delete(route('technician.offers.destroy', $offer))
        ->assertRedirect(route('feed.index'));

    expect(Offer::count())->toBe(0);
});

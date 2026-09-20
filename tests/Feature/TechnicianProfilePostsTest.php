<?php

use App\Models\Offer;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function tppTechnician(array $user = [], array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function tppRequest(User $owner, string $title, array $attributes = []): ServiceRequest
{
    return $owner->serviceRequests()->create([
        'title' => $title,
        'description' => 'It stopped working yesterday.',
        ...$attributes,
    ]);
}

test('the profile lists the requests the technician posted, open ones for visitors', function () {
    $technician = tppTechnician();
    tppRequest($technician, 'Need a part');
    tppRequest($technician, 'Closed one', ['status' => 'closed']);
    tppRequest(User::factory()->create(['role' => 'customer']), 'Somebody else\'s');

    $titles = fn (User $viewer) => collect(
        $this->actingAs($viewer)->get(route('technicians.show', $technician))->viewData('page')['props']['requests'],
    )->pluck('title')->all();

    expect($titles(User::factory()->create(['role' => 'customer'])))->toBe(['Need a part'])
        ->and($titles($technician))->toEqualCanonicalizing(['Need a part', 'Closed one']);
});

test('only the technician themself gets the panels to post an offer or a request', function () {
    $technician = tppTechnician([], ['city' => 'Sfax']);

    $this->actingAs($technician)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('requestForm.defaultCity', 'Sfax')
            ->has('requestForm.categories')
            ->has('requestForm.limits.title_max')
            ->has('offerForm.limits.max_offers'));

    foreach ([User::factory()->create(['role' => 'customer']), tppTechnician()] as $viewer) {
        $this->actingAs($viewer)
            ->get(route('technicians.show', $technician))
            ->assertInertia(fn (Assert $page) => $page->where('requestForm', null)->where('offerForm', null));
    }
});

test('the offers carry their date, to be listed among the requests', function () {
    $technician = tppTechnician();
    Offer::create(['technician_id' => $technician->id, 'title' => 'Boiler service']);

    $this->actingAs(User::factory()->create(['role' => 'customer']))
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('technician.offers.0.title', 'Boiler service')
            ->where('technician.offers.0.created_at', fn ($date) => is_string($date) && strtotime($date) !== false));
});

test('another technician sees which of the requests they already sent a quote to', function () {
    $owner = tppTechnician();
    $other = tppTechnician();
    $answered = tppRequest($owner, 'Answered');
    tppRequest($owner, 'Waiting');
    $answered->quotes()->create(['technician_id' => $other->id, 'price' => '80 TND']);

    $this->actingAs($other)
        ->get(route('technicians.show', $owner))
        ->assertInertia(function (Assert $page) {
            $requests = collect($page->toArray()['props']['requests'])->keyBy('title');

            expect($requests['Answered']['has_my_quote'])->toBeTrue()
                ->and($requests['Waiting']['has_my_quote'])->toBeFalse();
        });
});

test('the requests on a technician profile carry the public fields only', function () {
    $technician = tppTechnician(['email' => 'secret@example.com']);
    tppRequest($technician, 'Need a part', ['city' => 'Tunis']);

    $json = json_encode(
        $this->actingAs(User::factory()->create(['role' => 'customer']))
            ->get(route('technicians.show', $technician))
            ->viewData('page')['props']['requests'],
    );

    expect($json)->toContain('Need a part')->toContain('Tunis')->not->toContain('secret@example.com');
});

test('a request posted from the technician profile sends them back to it', function () {
    $technician = tppTechnician();

    $this->actingAs($technician)
        ->from(route('technicians.show', $technician))
        ->post(route('requests.store'), ['title' => 'Need a part', 'description' => 'For a boiler.', 'from_panel' => true])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('technicians.show', $technician));

    expect(ServiceRequest::sole()->customer_id)->toBe($technician->id);
});

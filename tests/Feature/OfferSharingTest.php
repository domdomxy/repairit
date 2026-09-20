<?php

use App\Models\Category;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Offer;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Support\ConversationList;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(Offer::MEDIA_DISK));

function shareTechnician(array $user = [], array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$user]);
    TechnicianProfile::create(['user_id' => $technician->id, ...$profile]);

    return $technician;
}

function shareCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function shareOffer(User $technician, string $title = 'Boiler service', array $attributes = []): Offer
{
    return Offer::create(['technician_id' => $technician->id, 'title' => $title, ...$attributes]);
}

// ------------------------------------------------------------------ category tags

test('a technician can tag an offer with one or more categories', function () {
    $technician = shareTechnician();
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $heating = Category::create(['name' => 'Heating', 'slug' => 'heating']);

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), [
            'title' => 'Boiler service',
            'categories' => [$plumbing->id, $heating->id],
        ])
        ->assertSessionHasNoErrors();

    $offer = Offer::firstOrFail();

    // Listed by name, and part of the card everyone sees.
    expect($offer->categories->pluck('name')->all())->toBe(['Heating', 'Plumbing'])
        ->and($offer->toCard()['categories'])->toHaveCount(2)
        ->and($offer->toCard()['categories'][0])->toHaveKeys(['id', 'name', 'slug']);
});

test('an offer can be re-tagged, and untagged by sending no categories', function () {
    $technician = shareTechnician();
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $heating = Category::create(['name' => 'Heating', 'slug' => 'heating']);
    $offer = shareOffer($technician);
    $offer->categories()->attach($plumbing);

    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), ['title' => 'Boiler service', 'categories' => [$heating->id]])
        ->assertSessionHasNoErrors();

    expect($offer->fresh()->categories->pluck('slug')->all())->toBe(['heating']);

    // An empty form sends no categories at all.
    $this->actingAs($technician)
        ->put(route('technician.offers.update', $offer), ['title' => 'Boiler service'])
        ->assertSessionHasNoErrors();

    expect($offer->fresh()->categories)->toHaveCount(0);
});

test('only existing categories can be used as tags', function () {
    $technician = shareTechnician();
    $plumbing = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => 'Boiler service', 'categories' => [$plumbing->id, 9999]])
        ->assertSessionHasErrors('categories.1');

    $this->actingAs($technician)
        ->post(route('technician.offers.store'), ['title' => 'Boiler service', 'categories' => 'plumbing'])
        ->assertSessionHasErrors('categories');

    expect(Offer::count())->toBe(0);
});

test('the offers page of a technician lists the categories to pick from', function () {
    $technician = shareTechnician();
    Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);

    $this->actingAs($technician)
        ->get(route('technician.offers.index'))
        ->assertInertia(fn (Assert $page) => $page->has('categories', 1)->where('categories.0.name', 'Plumbing'));
});

// ------------------------------------------------------------------ the offer's own page

test('an offer has a page of its own that any signed-in user can open', function () {
    $technician = shareTechnician(['name' => 'Samir'], ['city' => 'Tunis']);
    $category = Category::create(['name' => 'Plumbing', 'slug' => 'plumbing']);
    $offer = shareOffer($technician, 'Boiler service', ['price' => 'From 50 TND']);
    $offer->categories()->attach($category);

    $this->get(route('offers.show', $offer))->assertRedirect(route('login'));

    $this->actingAs(shareCustomer())
        ->get(route('offers.show', $offer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Offers/Show')
            ->where('offer.title', 'Boiler service')
            ->where('offer.price', 'From 50 TND')
            ->where('offer.categories.0.name', 'Plumbing')
            ->where('offer.technician.name', 'Samir')
            ->where('offer.technician.city', 'Tunis'));
});

test('an offer page never carries private contact data, and hides offers of suspended technicians', function () {
    $technician = shareTechnician(['email' => 'secret@example.com'], ['phone' => '99 999 999', 'address' => '1 Private Street']);
    $offer = shareOffer($technician);

    $props = $this->actingAs(shareCustomer())->get(route('offers.show', $offer))->viewData('page')['props'];

    expect(json_encode($props['offer']))
        ->not->toContain('secret@example.com')
        ->not->toContain('99 999 999')
        ->not->toContain('Private Street');

    $technician->forceFill(['suspended_at' => now()])->save();

    $this->actingAs(shareCustomer())->get(route('offers.show', $offer))->assertNotFound();
    $this->actingAs(shareCustomer())->get(route('offers.show', 9999))->assertNotFound();
});

// ------------------------------------------------------------------ sending an offer in the chat

test('sending an offer starts the chat and puts the offer in it as a message', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $offer = shareOffer($technician, 'Boiler service', ['price' => 'From 50 TND']);

    $this->actingAs($customer)
        ->post(route('offers.share', $offer))
        ->assertRedirect(route('conversations.show', Conversation::firstOrFail()));

    $message = Message::firstOrFail();

    expect($message->sender_id)->toBe($customer->id)
        ->and($message->body)->toBeNull()
        ->and($message->offer_id)->toBe($offer->id)
        ->and($message->offer_title)->toBe('Boiler service')
        ->and($message->conversation->technician_id)->toBe($technician->id)
        ->and($message->conversation->customer_id)->toBe($customer->id);
});

test('sending several offers to the same technician uses one conversation', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();

    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician, 'One')));
    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician, 'Two')));

    expect(Conversation::count())->toBe(1)->and(Message::count())->toBe(2);
});

test('an offer cannot be sent by guests, to yourself, or to a suspended technician', function () {
    $technician = shareTechnician();
    $offer = shareOffer($technician);

    $this->post(route('offers.share', $offer))->assertRedirect(route('login'));

    $this->actingAs($technician)->post(route('offers.share', $offer))->assertForbidden();

    $technician->forceFill(['suspended_at' => now()])->save();
    $this->actingAs(shareCustomer())->post(route('offers.share', $offer))->assertNotFound();

    expect(Message::count())->toBe(0)->and(Conversation::count())->toBe(0);
});

test('the chat carries the offer as a card, for both people', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $offer = shareOffer($technician, 'Boiler service', ['price' => 'From 50 TND']);
    $this->actingAs($customer)->post(route('offers.share', $offer));
    $conversation = Conversation::firstOrFail();

    foreach ([$customer, $technician] as $person) {
        $this->actingAs($person)
            ->get(route('conversations.show', $conversation))
            ->assertInertia(fn (Assert $page) => $page
                ->where('messages.0.body', null)
                ->where('messages.0.offer.id', $offer->id)
                ->where('messages.0.offer.title', 'Boiler service')
                ->where('messages.0.offer.price', 'From 50 TND')
                ->where('messages.0.offer.url', route('offers.show', $offer, absolute: false)));
    }

    // Ordinary messages carry no offer.
    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hello']);

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page->where('messages.1.offer', null));
});

test('the card shows the offer\'s first picture', function () {
    $technician = shareTechnician();
    $offer = shareOffer($technician);
    $path = UploadedFile::fake()->image('p.jpg', 200, 200)->store("offer-media/{$technician->id}", Offer::MEDIA_DISK);
    $media = $offer->media()->create(['path' => $path, 'name' => 'p.jpg', 'mime' => 'image/jpeg', 'size' => 1000]);

    $this->actingAs(shareCustomer())->post(route('offers.share', $offer));

    expect(Message::firstOrFail()->sharedOffer()['image_url'])->toBe($media->url);
});

test('once the offer is deleted the chat keeps its title and says it is gone', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $offer = shareOffer($technician, 'Boiler service');
    $this->actingAs($customer)->post(route('offers.share', $offer));
    $conversation = Conversation::firstOrFail();

    $this->actingAs($technician)->delete(route('technician.offers.destroy', $offer));

    $this->actingAs($customer)
        ->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.offer.title', 'Boiler service')
            ->where('messages.0.offer.id', null)
            ->where('messages.0.offer.url', null));
});

test('a shared offer can be deleted for everyone, but not edited', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician)));
    $message = Message::firstOrFail();

    $this->actingAs($customer)
        ->patch(route('messages.update', $message), ['body' => 'changed'])
        ->assertForbidden();

    $this->actingAs($customer)->delete(route('messages.destroy', $message), ['scope' => 'everyone']);

    $this->actingAs($technician)
        ->get(route('conversations.show', $message->conversation_id))
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.deleted', true)
            ->where('messages.0.offer', null));
});

test('the conversation list previews a shared offer', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician, 'Boiler service')));

    expect(ConversationList::for($technician)->first()->last_message['preview'])->toBe('Shared an offer: Boiler service')
        ->and(ConversationList::for($customer)->first()->last_message['preview'])->toBe('Shared an offer: Boiler service');
});

test('sending an offer as the first message triggers the technician\'s automatic reply', function () {
    $technician = shareTechnician([], ['auto_reply_enabled' => true]);
    $customer = shareCustomer();

    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician)));

    expect(Message::count())->toBe(2)
        ->and(Message::where('is_automated', true)->count())->toBe(1);

    // Only the first message earns one.
    $this->actingAs($customer)->post(route('offers.share', shareOffer($technician, 'Another')));

    expect(Message::count())->toBe(3)
        ->and(Message::where('is_automated', true)->count())->toBe(1);
});

test('a reported chat shows the admin which offer was shared', function () {
    $technician = shareTechnician();
    $customer = shareCustomer();
    $admin = User::factory()->create(['role' => 'admin']);
    $offer = shareOffer($technician, 'Boiler service');
    $this->actingAs($customer)->post(route('offers.share', $offer));
    $message = Message::firstOrFail();

    $this->actingAs($technician)
        ->post(route('messages.report', $message), ['reason' => 'spam'])
        ->assertSessionHasNoErrors();

    $report = App\Models\Report::firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.offer.title', 'Boiler service')
            ->where('messages.0.offer.url', route('offers.show', $offer, absolute: false)));
});

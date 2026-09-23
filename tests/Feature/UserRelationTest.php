<?php

use App\Models\Conversation;
use App\Models\Offer;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Models\UserRelation;
use App\Notifications\NewMessage;
use App\Support\ConversationList;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function relCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function relTechnician(array $attributes = [], array $profile = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id, 'city' => 'Tunis', ...$profile]);

    return $technician;
}

function relConversation(User $customer, User $technician): Conversation
{
    return Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
}

function relApply(User $user, User $target, string $relation): void
{
    UserRelation::create(['user_id' => $user->id, 'target_id' => $target->id, 'type' => $relation]);
}

// --- applying and undoing ----------------------------------------------------

test('each relation can be applied and undone, one way only', function (string $relation) {
    $me = relCustomer();
    $them = relTechnician();

    $this->actingAs($me)->post(route('relations.store', ['user' => $them, 'relation' => $relation]))
        ->assertRedirect()
        ->assertSessionHas('success');

    expect($me->hasRelation($relation, $them))->toBeTrue()
        ->and($them->hasRelation($relation, $me))->toBeFalse();

    // Doing it twice changes nothing.
    $this->actingAs($me)->post(route('relations.store', ['user' => $them, 'relation' => $relation]));
    expect(UserRelation::where('type', $relation)->count())->toBe(1);

    $this->actingAs($me)->delete(route('relations.destroy', ['user' => $them, 'relation' => $relation]))
        ->assertRedirect();

    expect($me->hasRelation($relation, $them))->toBeFalse();
})->with(['block', 'mute', 'favorite', 'restrict']);

test('an unknown relation is not found', function () {
    $this->actingAs(relCustomer())
        ->post('/people/'.relTechnician()->id.'/ghost')
        ->assertNotFound();
});

test('you cannot do any of it to yourself or to an admin', function () {
    $me = relCustomer();
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($me)->post(route('relations.store', ['user' => $me, 'relation' => 'block']))->assertForbidden();
    $this->actingAs($me)->post(route('relations.store', ['user' => $admin, 'relation' => 'mute']))->assertForbidden();

    expect(UserRelation::count())->toBe(0);
});

test('guests cannot use them', function () {
    $this->post(route('relations.store', ['user' => relTechnician(), 'relation' => 'block']))
        ->assertRedirect(route('login'));
});

test('blocking someone removes them from your favorites, and a blocked person cannot be favorited', function () {
    $me = relCustomer();
    $them = relTechnician();

    relApply($me, $them, UserRelation::FAVORITE);
    $this->actingAs($me)->post(route('relations.store', ['user' => $them, 'relation' => 'block']));

    expect($me->hasRelation(UserRelation::FAVORITE, $them))->toBeFalse();

    $this->actingAs($me)->post(route('relations.store', ['user' => $them, 'relation' => 'favorite']))
        ->assertStatus(422);
});

test('the relations page lists each kind, and unblocking works from it', function () {
    $me = relCustomer();
    $blocked = relTechnician(['name' => 'Karim Blocked']);
    $starred = relTechnician(['name' => 'Nour Starred']);

    relApply($me, $blocked, UserRelation::BLOCK);
    relApply($me, $starred, UserRelation::FAVORITE);

    $this->actingAs($me)->get(route('relations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Settings/Index')
            ->where('lists.block.0.name', 'Karim Blocked')
            ->where('lists.favorite.0.name', 'Nour Starred')
            ->where('lists.mute', [])
            ->where('lists.restrict', []));

    $this->actingAs($me)->delete(route('relations.destroy', ['user' => $blocked, 'relation' => 'block']));

    expect($me->hasBlocked($blocked))->toBeFalse();
});

test('deleting an account removes the relations it was part of', function () {
    $me = relCustomer();
    $them = relTechnician();
    relApply($me, $them, UserRelation::BLOCK);
    relApply($them, $me, UserRelation::MUTE);

    $them->delete();

    expect(UserRelation::count())->toBe(0);
});

// --- blocking ----------------------------------------------------------------

test('a block stops both people from starting a conversation', function () {
    $customer = relCustomer();
    $technician = relTechnician();

    relApply($technician, $customer, UserRelation::BLOCK);

    $this->actingAs($customer)->post(route('conversations.start', $technician))->assertForbidden();

    // The one who blocked can't either, until they unblock.
    UserRelation::query()->delete();
    relApply($customer, $technician, UserRelation::BLOCK);

    $this->actingAs($customer)->post(route('conversations.start', $technician))->assertForbidden();

    expect(Conversation::count())->toBe(0);
});

test('a block stops messages and shared locations in an existing conversation, but it stays readable', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Before the block']);

    relApply($technician, $customer, UserRelation::BLOCK);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hello?'])->assertForbidden();
    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'No.'])->assertForbidden();
    $this->actingAs($customer)->post(route('messages.location.store', $conversation), ['lat' => 36.8, 'lng' => 10.1])->assertForbidden();

    expect($conversation->messages()->count())->toBe(1);

    $this->actingAs($customer)->get(route('conversations.show', $conversation))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('messages.0.body', 'Before the block')
            ->where('contact.can_message', false)
            // The blocked person is not told who blocked whom.
            ->where('contact.relations.blocked', false));

    $this->actingAs($technician)->get(route('conversations.show', $conversation))
        ->assertInertia(fn (Assert $page) => $page
            ->where('contact.can_message', false)
            ->where('contact.relations.blocked', true));
});

test('unblocking lets them write again', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::BLOCK);
    $this->actingAs($technician)->delete(route('relations.destroy', ['user' => $customer, 'relation' => 'block']));

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hi again'])->assertRedirect();

    expect($conversation->messages()->count())->toBe(1);
});

test('a block stops offers, requests and quotes from being sent', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $offer = Offer::create(['technician_id' => $technician->id, 'title' => 'Boiler service']);
    $serviceRequest = $customer->serviceRequests()->create(['description' => 'Cracked screen', 'city' => 'Tunis']);

    relApply($customer, $technician, UserRelation::BLOCK);

    $this->actingAs($customer)->post(route('offers.share', $offer), [])->assertForbidden();
    $this->actingAs($technician)->post(route('requests.share', $serviceRequest), [])->assertForbidden();
    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '50 TND'])->assertForbidden();

    expect(Conversation::count())->toBe(0)
        ->and($serviceRequest->quotes()->count())->toBe(0);
});

test('a block stops reviews', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'Hi']);
    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Hello']);

    relApply($technician, $customer, UserRelation::BLOCK);

    $this->actingAs($customer)->post(route('reviews.store', $technician), ['rating' => 5])->assertForbidden();
    $this->actingAs($technician)->post(route('customer-reviews.store', $customer), ['rating' => 5])->assertForbidden();
});

test('someone who blocked you has no profile, offer or request page for you, but you still see theirs', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $offer = Offer::create(['technician_id' => $technician->id, 'title' => 'Boiler service']);
    $serviceRequest = $customer->serviceRequests()->create(['description' => 'Cracked screen', 'city' => 'Tunis']);

    relApply($technician, $customer, UserRelation::BLOCK);

    $this->actingAs($customer)->get(route('technicians.show', $technician))->assertNotFound();
    $this->actingAs($customer)->get(route('offers.show', $offer))->assertNotFound();

    // The technician, who did the blocking, still sees the customer's profile and request (flagged as blocked, so they can unblock there).
    $this->actingAs($technician)->get(route('customers.show', $customer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('relations.blocked', true));
    $this->actingAs($technician)->get(route('requests.show', $serviceRequest))->assertOk();

    relApply($customer, $technician, UserRelation::BLOCK);
    $this->actingAs($technician)->get(route('customers.show', $customer))->assertNotFound();
    $this->actingAs($technician)->get(route('requests.show', $serviceRequest))->assertNotFound();
});

test('blocked people disappear from the technician search and the feed, in both directions', function () {
    $viewer = relCustomer();
    $blockedByMe = relTechnician(['name' => 'Blocked By Me']);
    $blocksMe = relTechnician(['name' => 'Blocks Me']);
    $visible = relTechnician(['name' => 'Still Here']);

    foreach ([$blockedByMe, $blocksMe, $visible] as $technician) {
        Offer::create(['technician_id' => $technician->id, 'title' => "Offer of {$technician->name}"]);
    }

    relApply($viewer, $blockedByMe, UserRelation::BLOCK);
    relApply($blocksMe, $viewer, UserRelation::BLOCK);

    $this->actingAs($viewer)->get(route('search.index', ['city' => 'Tunis']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 1)
            ->where('technicians.data.0.name', 'Still Here'));

    $this->actingAs($viewer)->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page->has('feed.data', 1));
});

test('blocked customers and their requests disappear too', function () {
    $technician = relTechnician();
    $blocked = relCustomer(['name' => 'Blocked Customer']);
    $other = relCustomer(['name' => 'Other Customer']);

    $blocked->serviceRequests()->create(['description' => 'From the blocked one', 'city' => 'Tunis']);
    $other->serviceRequests()->create(['description' => 'From the other one', 'city' => 'Tunis']);

    relApply($technician, $blocked, UserRelation::BLOCK);

    $this->actingAs($technician)->get(route('search.index', ['type' => 'requests', 'city' => 'Tunis']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('requests.data', 1)
            ->where('requests.data.0.description', 'From the other one'));

    $this->actingAs($technician)->get(route('feed.index', ['filter' => 'requests']))
        ->assertInertia(fn (Assert $page) => $page->has('feed.data', 1));
});

// --- muting ------------------------------------------------------------------

test('a muted person can still write, without a notification or an unread badge', function () {
    Notification::fake();

    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::MUTE);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Are you there?'])->assertRedirect();

    expect($conversation->messages()->count())->toBe(1);
    Notification::assertNotSentTo($technician, NewMessage::class);

    // Still listed and still unread on the page, but not counted in the top bar.
    $this->actingAs($technician)->get(route('conversations.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('conversations.0.unread_count', 1)
            ->where('conversations.0.is_muted', true)
            ->where('inbox.unread', 0));
});

test('muting is one way: the muted person still hears back', function () {
    Notification::fake();

    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::MUTE);

    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'Yes, I am here'])->assertRedirect();

    Notification::assertSentTo($customer, NewMessage::class);
});

test('unmuting brings notifications back', function () {
    Notification::fake();

    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::MUTE);
    $this->actingAs($technician)->delete(route('relations.destroy', ['user' => $customer, 'relation' => 'mute']));

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hello'])->assertRedirect();

    Notification::assertSentTo($technician, NewMessage::class);
});

// --- restricting -------------------------------------------------------------

test('a restricted person\'s messages wait in requests, silently', function () {
    Notification::fake();

    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    // The technician answered before, so it would normally be in the inbox.
    $conversation->messages()->create(['sender_id' => $customer->id, 'body' => 'First']);
    $conversation->messages()->create(['sender_id' => $technician->id, 'body' => 'Answer']);
    expect(ConversationList::for($technician)->first()->is_request)->toBeFalse();

    relApply($technician, $customer, UserRelation::RESTRICT);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Any news?'])->assertRedirect();

    Notification::assertNotSentTo($technician, NewMessage::class);

    $listed = ConversationList::for($technician)->first();
    expect($listed->is_request)->toBeTrue()
        ->and($listed->is_restricted)->toBeTrue();

    // Replying does not lift it: only unrestricting does.
    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'Later'])->assertRedirect();
    expect(ConversationList::for($technician)->first()->is_request)->toBeTrue();

    $this->actingAs($technician)->delete(route('relations.destroy', ['user' => $customer, 'relation' => 'restrict']));
    expect(ConversationList::for($technician)->first()->is_request)->toBeFalse();
});

test('a restricted customer gets no automatic reply', function () {
    $customer = relCustomer();
    $technician = relTechnician([], ['auto_reply_enabled' => true]);
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::RESTRICT);

    $this->actingAs($customer)->post(route('messages.store', $conversation), ['body' => 'Hello'])->assertRedirect();

    expect($conversation->messages()->count())->toBe(1);
});

test('restricting does not stop the restricted person from being written to', function () {
    $customer = relCustomer();
    $technician = relTechnician();
    $conversation = relConversation($customer, $technician);

    relApply($technician, $customer, UserRelation::RESTRICT);

    $this->actingAs($technician)->post(route('messages.store', $conversation), ['body' => 'Still fine'])->assertRedirect();

    expect($conversation->messages()->count())->toBe(1);
});

// --- favorites ---------------------------------------------------------------

test('favorites are listed first in the messages list', function () {
    $customer = relCustomer();
    $older = relTechnician(['name' => 'Older Favorite']);
    $newer = relTechnician(['name' => 'Newer']);

    $oldConversation = relConversation($customer, $older);
    $oldConversation->messages()->create(['sender_id' => $customer->id, 'body' => 'old']);
    $oldConversation->update(['last_message_at' => now()->subDay()]);

    $newConversation = relConversation($customer, $newer);
    $newConversation->messages()->create(['sender_id' => $customer->id, 'body' => 'new']);
    $newConversation->update(['last_message_at' => now()]);

    expect(ConversationList::for($customer)->first()->id)->toBe($newConversation->id);

    relApply($customer, $older, UserRelation::FAVORITE);

    $list = ConversationList::for($customer);

    expect($list->first()->id)->toBe($oldConversation->id)
        ->and($list->first()->is_favorite)->toBeTrue()
        ->and($list->last()->is_favorite)->toBeFalse();
});

test('the technician search marks favorites and can show only them', function () {
    $customer = relCustomer();
    $starred = relTechnician(['name' => 'Starred One']);
    $other = relTechnician(['name' => 'Someone Else']);

    relApply($customer, $starred, UserRelation::FAVORITE);

    $this->actingAs($customer)->get(route('search.index', ['city' => 'Tunis']))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 2)
            ->where('technicians.data', fn ($rows) => collect($rows)->firstWhere('id', $starred->id)['is_favorite'] === true
                && collect($rows)->firstWhere('id', $other->id)['is_favorite'] === false));

    $this->actingAs($customer)->get(route('search.index', ['favorites' => 1]))
        ->assertInertia(fn (Assert $page) => $page
            ->has('technicians.data', 1)
            ->where('technicians.data.0.name', 'Starred One'));
});

test('a profile carries what the viewer did about that person, and nothing on their own', function () {
    $customer = relCustomer();
    $technician = relTechnician();

    relApply($customer, $technician, UserRelation::MUTE);
    relApply($customer, $technician, UserRelation::FAVORITE);

    $this->actingAs($customer)->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page
            ->where('relations', ['blocked' => false, 'muted' => true, 'favorited' => true, 'restricted' => false]));

    $this->actingAs($technician)->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page->where('relations', null));
});

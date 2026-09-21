<?php

use App\Models\Conversation;
use App\Models\Quote;
use App\Models\TechnicianProfile;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function mqCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function mqTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id, 'city' => 'Tunis']);

    return $technician;
}

function mqQuote(User $technician, User $customer, string $price, array $request = [], array $quote = []): Quote
{
    $serviceRequest = $customer->serviceRequests()->create([
        'description' => "Needs fixing ({$price})",
        ...$request,
    ]);

    return $serviceRequest->quotes()->create(['technician_id' => $technician->id, 'price' => $price, ...$quote]);
}

test('only technicians have a My quotes page', function () {
    $this->get(route('technician.quotes.index'))->assertRedirect(route('login'));

    $this->actingAs(mqCustomer())->get(route('technician.quotes.index'))->assertForbidden();
    $this->actingAs(User::factory()->create(['role' => 'admin']))->get(route('technician.quotes.index'))->assertForbidden();

    $this->actingAs(mqTechnician())->get(route('technician.quotes.index'))->assertOk();
});

test('My quotes lists the technician\'s own quotes, newest first, with what became of each', function () {
    $technician = mqTechnician();
    $customer = mqCustomer();

    $waiting = mqQuote($technician, $customer, '30 TND');
    $chosen = mqQuote($technician, $customer, '40 TND');
    $chosen->forceFill(['accepted_at' => now()])->save();
    $chosen->serviceRequest->update(['status' => 'closed']);
    $lost = mqQuote($technician, $customer, '50 TND', ['status' => 'closed']);

    // Somebody else's quote is never listed.
    mqQuote(mqTechnician(), $customer, '99 TND');

    $waiting->forceFill(['created_at' => now()->subMinutes(3)])->save();
    $chosen->forceFill(['created_at' => now()->subMinutes(2)])->save();
    $lost->forceFill(['created_at' => now()->subMinute()])->save();

    $this->actingAs($technician)
        ->get(route('technician.quotes.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('Quotes/Index')
            ->where('status', 'all')
            ->where('counts', ['all' => 3, 'pending' => 1, 'chosen' => 1, 'closed' => 1])
            ->has('quotes.data', 3)
            ->where('quotes.data.0.price', '50 TND')
            ->where('quotes.data.0.status', 'closed')
            ->where('quotes.data.1.status', 'chosen')
            ->where('quotes.data.2.status', 'pending')
            ->where('quoteLimits.price_max', Quote::PRICE_MAX)
            ->where('quotes.data.2.request.customer.name', $customer->name)
            ->missing('quotes.data.2.request.customer.email'));
});

test('My quotes can be narrowed down to waiting, chosen or closed quotes', function () {
    $technician = mqTechnician();
    $customer = mqCustomer();

    mqQuote($technician, $customer, '30 TND');
    $chosen = mqQuote($technician, $customer, '40 TND');
    $chosen->forceFill(['accepted_at' => now()])->save();
    $chosen->serviceRequest->update(['status' => 'closed']);
    mqQuote($technician, $customer, '50 TND', ['status' => 'closed']);

    foreach (['pending' => '30 TND', 'chosen' => '40 TND', 'closed' => '50 TND'] as $status => $price) {
        $this->actingAs($technician)
            ->get(route('technician.quotes.index', ['status' => $status]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('status', $status)
                ->has('quotes.data', 1)
                ->where('quotes.data.0.price', $price));
    }

    // Anything else is "all".
    $this->actingAs($technician)
        ->get(route('technician.quotes.index', ['status' => 'nonsense']))
        ->assertInertia(fn (Assert $page) => $page->where('status', 'all')->has('quotes.data', 3));
});

test('quotes on a suspended customer\'s requests are left out', function () {
    $technician = mqTechnician();
    $suspended = mqCustomer();

    mqQuote($technician, $suspended, '30 TND');
    $suspended->forceFill(['suspended_at' => now()])->save();

    $this->actingAs($technician)
        ->get(route('technician.quotes.index'))
        ->assertInertia(fn (Assert $page) => $page->has('quotes.data', 0)->where('counts.all', 0));
});

test('each quote links to the chat with its customer, when there is one', function () {
    $technician = mqTechnician();
    $withChat = mqCustomer();
    $withoutChat = mqCustomer();

    mqQuote($technician, $withChat, '30 TND');
    mqQuote($technician, $withoutChat, '40 TND');

    $conversation = Conversation::create(['customer_id' => $withChat->id, 'technician_id' => $technician->id]);

    $this->actingAs($technician)
        ->get(route('technician.quotes.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('quotes.data.0.conversation_id', null)
            ->where('quotes.data.1.conversation_id', $conversation->id));
});

test('the technician can edit and delete a quote from the page, on the same routes as the chat card', function () {
    $technician = mqTechnician();
    $quote = mqQuote($technician, mqCustomer(), '30 TND');

    $this->actingAs($technician)
        ->from(route('technician.quotes.index'))
        ->post(route('requests.quotes.store', $quote->serviceRequest), ['price' => '25 TND'])
        ->assertRedirect(route('technician.quotes.index'));

    expect($quote->fresh()->price)->toBe('25 TND');

    $this->actingAs($technician)
        ->from(route('technician.quotes.index'))
        ->delete(route('requests.quote.destroy', $quote->serviceRequest))
        ->assertRedirect(route('technician.quotes.index'));

    expect(Quote::count())->toBe(0);
});

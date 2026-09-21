<?php

use App\Models\Category;
use App\Models\Quote;
use App\Models\ServiceRequest;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewQuote;
use App\Notifications\QuoteAccepted;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

function srCustomer(array $attributes = []): User
{
    return User::factory()->create(['role' => 'customer', ...$attributes]);
}

function srTechnician(array $attributes = []): User
{
    $technician = User::factory()->create(['role' => 'technician', ...$attributes]);
    TechnicianProfile::create(['user_id' => $technician->id, 'city' => 'Tunis']);

    return $technician;
}

function srRequest(User $customer, array $attributes = []): ServiceRequest
{
    return $customer->serviceRequests()->create([
        'description' => 'The screen cracked when I dropped it.',
        ...$attributes,
    ]);
}

function srQuote(ServiceRequest $serviceRequest, User $technician, string $price = '80 TND'): Quote
{
    return $serviceRequest->quotes()->create(['technician_id' => $technician->id, 'price' => $price]);
}

function srCategory(string $name): Category
{
    return Category::create(['name' => $name, 'slug' => str($name)->slug()->toString()]);
}

// --- posting ---------------------------------------------------------------

test('a customer can post a repair request with categories', function () {
    $customer = srCustomer();
    $phones = srCategory('Phones');
    $screens = srCategory('Screens');

    $this->actingAs($customer)
        ->post(route('requests.store'), [
            'description' => 'It cracked when I dropped it.',
            'budget' => 'Up to 100 TND',
            'city' => 'Tunis',
            'categories' => [$phones->id, $screens->id],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $serviceRequest = ServiceRequest::sole();

    expect($serviceRequest->customer_id)->toBe($customer->id)
        ->and($serviceRequest->description)->toBe('It cracked when I dropped it.')
        ->and($serviceRequest->budget)->toBe('Up to 100 TND')
        ->and($serviceRequest->city)->toBe('Tunis')
        ->and($serviceRequest->status)->toBe('open')
        ->and($serviceRequest->categories->pluck('name')->all())->toBe(['Phones', 'Screens']);
});

test('anybody signed in can post a request', function () {
    $this->actingAs(srTechnician())
        ->post(route('requests.store'), ['description' => 'Kitchen tap drips all night.'])
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::count())->toBe(1);
});

test('guests cannot post or browse requests', function () {
    $this->post(route('requests.store'), ['description' => 'Drips.'])->assertRedirect(route('login'));
    $this->get(route('requests.index'))->assertRedirect(route('login'));
});

test('a request needs a description, and only real categories', function () {
    $customer = srCustomer();

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => ''])
        ->assertSessionHasErrors('description');

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => 'y', 'categories' => [999]])
        ->assertSessionHasErrors('categories.0');

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => str_repeat('a', 2001)])
        ->assertSessionHasErrors('description');

    $many = collect(range(1, 6))->map(fn ($i) => srCategory("Category {$i}")->id)->all();

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => 'y', 'categories' => $many])
        ->assertSessionHasErrors('categories');

    expect(ServiceRequest::count())->toBe(0);
});

test('nobody can have more than ten open requests', function () {
    $customer = srCustomer();

    foreach (range(1, ServiceRequest::MAX_OPEN_PER_CUSTOMER) as $i) {
        srRequest($customer, ['description' => "Request {$i}"]);
    }

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => 'Please'])
        ->assertSessionHasErrors('description');

    expect(ServiceRequest::count())->toBe(10);

    // Closed ones do not count.
    ServiceRequest::first()->update(['status' => 'closed']);

    $this->actingAs($customer)
        ->post(route('requests.store'), ['description' => 'Please'])
        ->assertSessionHasNoErrors();

    expect(ServiceRequest::count())->toBe(11);
});

// --- browsing --------------------------------------------------------------

test('the open requests page lists open requests of active customers only, without their email', function () {
    $customer = srCustomer();
    $open = srRequest($customer, ['description' => 'Open one']);
    srRequest($customer, ['description' => 'Closed one', 'status' => 'closed']);

    $suspended = srCustomer();
    srRequest($suspended, ['description' => 'From a suspended customer']);
    $suspended->forceFill(['suspended_at' => now()])->save();

    $this->actingAs(srTechnician())
        ->get(route('requests.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Requests/Index')
            ->where('scope', 'all')
            ->has('requests.data', 1)
            ->where('requests.data.0.id', $open->id)
            ->where('requests.data.0.customer.name', $customer->name)
            ->where('requests.data.0.quotes_count', 0)
            ->missing('requests.data.0.customer.email'));
});

test('requests can be searched and filtered by category and city', function () {
    $customer = srCustomer();
    $phones = srCategory('Phones');
    $plumbing = srCategory('Plumbing');

    $phone = srRequest($customer, ['description' => 'Cracked phone screen', 'city' => 'Tunis']);
    $phone->categories()->sync([$phones->id]);

    $tap = srRequest($customer, ['description' => 'Leaking tap, drips all night', 'city' => 'Sfax']);
    $tap->categories()->sync([$plumbing->id]);

    $technician = srTechnician();

    $only = fn (array $query, array $expected) => $this->actingAs($technician)
        ->get(route('requests.index', $query))
        ->assertInertia(fn (Assert $page) => $page
            ->has('requests.data', count($expected))
            ->when($expected !== [], fn (Assert $page) => $page->where('requests.data.0.id', $expected[0])));

    $only(['q' => 'phone'], [$phone->id]);
    $only(['q' => 'drips'], [$tap->id]);
    $only(['category' => 'plumbing'], [$tap->id]);
    $only(['city' => 'tun'], [$phone->id]);
    // A search for "%" means a percent sign, not "anything".
    $only(['q' => '%'], []);
    $only([], [$tap->id, $phone->id]);
});

test('a technician sees which requests they already answered', function () {
    $technician = srTechnician();
    $answered = srRequest(srCustomer(), ['description' => 'Answered']);
    srRequest(srCustomer(), ['description' => 'Not answered']);
    srQuote($answered, $technician);

    $this->actingAs($technician)
        ->get(route('requests.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('requests.data', 2)
            ->where('requests.data.0.description', 'Not answered')
            ->where('requests.data.0.has_my_quote', false)
            ->where('requests.data.1.description', 'Answered')
            ->where('requests.data.1.has_my_quote', true)
            ->where('requests.data.1.quotes_count', 1));
});

test('my requests lists only mine, open or closed', function () {
    $customer = srCustomer();
    $mine = srRequest($customer, ['description' => 'Mine']);
    $closed = srRequest($customer, ['description' => 'Mine, closed', 'status' => 'closed']);
    srRequest(srCustomer(), ['description' => 'Someone else\'s']);

    $this->actingAs($customer)
        ->get(route('requests.mine'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('scope', 'mine')
            ->has('requests.data', 2)
            ->where('requests.data.0.id', $closed->id)
            ->where('requests.data.1.id', $mine->id));
});

// --- managing your own -----------------------------------------------------

test('the owner can edit a request, nobody else can', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $category = srCategory('Phones');

    $this->actingAs($customer)
        ->get(route('requests.edit', $serviceRequest))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('Requests/Form')->where('serviceRequest.id', $serviceRequest->id));

    $this->actingAs($customer)
        ->put(route('requests.update', $serviceRequest), [
            'description' => 'Cracked screen and dead battery',
            'categories' => [$category->id],
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('requests.show', $serviceRequest));

    $serviceRequest->refresh();

    expect($serviceRequest->description)->toBe('Cracked screen and dead battery')
        ->and($serviceRequest->categories)->toHaveCount(1);

    $stranger = srCustomer();

    $this->actingAs($stranger)->get(route('requests.edit', $serviceRequest))->assertForbidden();
    $this->actingAs($stranger)->put(route('requests.update', $serviceRequest), ['description' => 'Hijacked'])->assertForbidden();
    $this->actingAs($stranger)->post(route('requests.close', $serviceRequest))->assertForbidden();
    $this->actingAs($stranger)->post(route('requests.reopen', $serviceRequest))->assertForbidden();
    $this->actingAs($stranger)->delete(route('requests.destroy', $serviceRequest))->assertForbidden();

    expect($serviceRequest->refresh()->description)->toBe('Cracked screen and dead battery');
});

test('a request can be closed and reopened, and reopening drops the technician chosen before', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $quote = srQuote($serviceRequest, srTechnician());

    $this->actingAs($customer)->post(route('quotes.accept', $quote));

    expect($serviceRequest->refresh()->status)->toBe('closed')
        ->and($quote->refresh()->accepted_at)->not->toBeNull();

    $this->actingAs($customer)->post(route('requests.reopen', $serviceRequest))->assertSessionHasNoErrors();

    expect($serviceRequest->refresh()->status)->toBe('open')
        ->and($quote->refresh()->accepted_at)->toBeNull();

    $this->actingAs($customer)->post(route('requests.close', $serviceRequest));

    expect($serviceRequest->refresh()->status)->toBe('closed');
});

test('a closed request cannot be reopened past the limit of open ones', function () {
    $customer = srCustomer();
    $closed = srRequest($customer, ['status' => 'closed']);

    foreach (range(1, ServiceRequest::MAX_OPEN_PER_CUSTOMER) as $i) {
        srRequest($customer, ['description' => "Request {$i}"]);
    }

    $this->actingAs($customer)->post(route('requests.reopen', $closed))->assertSessionHasErrors('status');

    expect($closed->refresh()->status)->toBe('closed');
});

test('deleting a request deletes its quotes', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    srQuote($serviceRequest, srTechnician());

    $this->actingAs($customer)
        ->delete(route('requests.destroy', $serviceRequest))
        ->assertRedirect(route('requests.mine'));

    expect(ServiceRequest::count())->toBe(0)
        ->and(Quote::count())->toBe(0);
});

// --- who sees what ---------------------------------------------------------

test('quotes are private to the customer and the technician who wrote them', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $first = srTechnician();
    $second = srTechnician();
    srQuote($serviceRequest, $first, '50 TND');
    srQuote($serviceRequest, $second, '70 TND');

    // The customer sees both, with the technicians' public cards only.
    $this->actingAs($customer)
        ->get(route('requests.show', $serviceRequest))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Requests/Show')
            ->where('isOwner', true)
            ->has('quotes', 2)
            ->where('myQuote', null)
            ->where('serviceRequest.quotes_count', 2)
            ->missing('quotes.0.technician.email')
            ->missing('quotes.0.technician.phone'));

    // A technician sees their own.
    $this->actingAs($first)
        ->get(route('requests.show', $serviceRequest))
        ->assertInertia(fn (Assert $page) => $page
            ->where('isOwner', false)
            ->has('quotes', 0)
            ->where('myQuote.price', '50 TND')
            ->where('canQuote', true));

    // Anybody else sees that quotes exist, and nothing of them.
    $this->actingAs(srCustomer())
        ->get(route('requests.show', $serviceRequest))
        ->assertInertia(fn (Assert $page) => $page
            ->has('quotes', 0)
            ->where('myQuote', null)
            ->where('canQuote', false)
            ->where('serviceRequest.quotes_count', 2));
});

test('a suspended customer\'s request is hidden from others but not from them', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $customer->forceFill(['suspended_at' => now()])->save();

    $this->actingAs(srTechnician())->get(route('requests.show', $serviceRequest))->assertNotFound();
});

// --- quotes ----------------------------------------------------------------

test('a technician can send a quote and the customer is told', function () {
    Notification::fake();

    $customer = srCustomer();
    $technician = srTechnician();
    $serviceRequest = srRequest($customer);

    $this->actingAs($technician)
        ->post(route('requests.quotes.store', $serviceRequest), [
            'price' => '80 TND',
            'estimated_time' => '2 days',
            'message' => 'Original screen, one year warranty.',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    $quote = Quote::sole();

    expect($quote->service_request_id)->toBe($serviceRequest->id)
        ->and($quote->technician_id)->toBe($technician->id)
        ->and($quote->price)->toBe('80 TND')
        ->and($quote->estimated_time)->toBe('2 days')
        ->and($quote->accepted_at)->toBeNull();

    Notification::assertSentTo($customer, NewQuote::class);
    Notification::assertNotSentTo($technician, NewQuote::class);
});

test('sending again changes the quote and does not notify the customer twice', function () {
    Notification::fake();

    $customer = srCustomer();
    $technician = srTechnician();
    $serviceRequest = srRequest($customer);

    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '80 TND']);
    $this->actingAs($technician)->post(route('requests.quotes.store', $serviceRequest), ['price' => '65 TND', 'message' => 'Cheaper.']);

    expect(Quote::count())->toBe(1)
        ->and(Quote::sole()->price)->toBe('65 TND')
        ->and(Quote::sole()->message)->toBe('Cheaper.');

    Notification::assertSentToTimes($customer, NewQuote::class, 1);
});

test('a quote needs a price', function () {
    $serviceRequest = srRequest(srCustomer());

    $this->actingAs(srTechnician())
        ->post(route('requests.quotes.store', $serviceRequest), ['price' => '', 'message' => 'Free!'])
        ->assertSessionHasErrors('price');

    $this->actingAs(srTechnician())
        ->post(route('requests.quotes.store', $serviceRequest), ['price' => str_repeat('9', 61)])
        ->assertSessionHasErrors('price');

    expect(Quote::count())->toBe(0);
});

test('only technicians with a profile can quote, never on their own or a closed or hidden request', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $payload = ['price' => '80 TND'];

    // A customer, an admin and a technician without a profile.
    $this->actingAs(srCustomer())->post(route('requests.quotes.store', $serviceRequest), $payload)->assertForbidden();
    $this->actingAs(User::factory()->create(['role' => 'admin']))->post(route('requests.quotes.store', $serviceRequest), $payload)->assertForbidden();
    $this->actingAs(User::factory()->create(['role' => 'technician']))->post(route('requests.quotes.store', $serviceRequest), $payload)->assertForbidden();

    // A technician's own request.
    $technician = srTechnician();
    $own = srRequest($technician);
    $this->actingAs($technician)->post(route('requests.quotes.store', $own), $payload)->assertForbidden();

    // A closed request.
    $serviceRequest->update(['status' => 'closed']);
    $this->actingAs(srTechnician())->post(route('requests.quotes.store', $serviceRequest), $payload)->assertForbidden();

    // A suspended customer's request.
    $serviceRequest->update(['status' => 'open']);
    $customer->forceFill(['suspended_at' => now()])->save();
    $this->actingAs(srTechnician())->post(route('requests.quotes.store', $serviceRequest), $payload)->assertNotFound();

    expect(Quote::count())->toBe(0);
});

test('a technician can withdraw their quote, unless it was chosen', function () {
    $customer = srCustomer();
    $technician = srTechnician();
    $other = srTechnician();
    $serviceRequest = srRequest($customer);
    $mine = srQuote($serviceRequest, $technician);
    $theirs = srQuote($serviceRequest, $other);

    $this->actingAs($technician)->delete(route('requests.quote.destroy', $serviceRequest))->assertRedirect();

    expect(Quote::pluck('id')->all())->toBe([$theirs->id]);

    // The customer chose the other one: it can no longer be taken back.
    $this->actingAs($customer)->post(route('quotes.accept', $theirs));
    $this->actingAs($other)->delete(route('requests.quote.destroy', $serviceRequest))->assertForbidden();

    expect(Quote::count())->toBe(1);

    // Nothing to withdraw.
    $this->actingAs($technician)->delete(route('requests.quote.destroy', $serviceRequest))->assertNotFound();
});

test('the customer can choose a quote: the request closes and the technician is told', function () {
    Notification::fake();

    $customer = srCustomer();
    $chosen = srTechnician();
    $other = srTechnician();
    $serviceRequest = srRequest($customer);
    $quote = srQuote($serviceRequest, $chosen, '60 TND');
    $notChosen = srQuote($serviceRequest, $other, '90 TND');

    $this->actingAs($customer)
        ->post(route('quotes.accept', $quote))
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($quote->refresh()->accepted_at)->not->toBeNull()
        ->and($notChosen->refresh()->accepted_at)->toBeNull()
        ->and($serviceRequest->refresh()->status)->toBe('closed');

    Notification::assertSentTo($chosen, QuoteAccepted::class);
    Notification::assertNotSentTo($other, QuoteAccepted::class);

    // The chosen quote comes first in the customer's list.
    $this->actingAs($customer)
        ->get(route('requests.show', $serviceRequest))
        ->assertInertia(fn (Assert $page) => $page
            ->where('quotes.0.accepted', true)
            ->where('quotes.0.price', '60 TND')
            ->where('quotes.1.accepted', false));
});

test('only the customer who asked can choose, and only while the request is open', function () {
    $customer = srCustomer();
    $serviceRequest = srRequest($customer);
    $technician = srTechnician();
    $quote = srQuote($serviceRequest, $technician);

    $this->actingAs(srCustomer())->post(route('quotes.accept', $quote))->assertForbidden();
    $this->actingAs($technician)->post(route('quotes.accept', $quote))->assertForbidden();

    expect($quote->refresh()->accepted_at)->toBeNull();

    $serviceRequest->update(['status' => 'closed']);

    $this->actingAs($customer)->post(route('quotes.accept', $quote))->assertForbidden();

    expect($quote->refresh()->accepted_at)->toBeNull();
});

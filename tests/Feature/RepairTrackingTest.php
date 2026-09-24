<?php

use App\Models\Conversation;
use App\Models\Repair;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\RepairUpdated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function repairTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function repairCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function repairChat(User $customer, User $technician): Conversation
{
    return Conversation::create(['customer_id' => $customer->id, 'technician_id' => $technician->id]);
}

function repairFor(User $technician, array $attributes = []): Repair
{
    $repair = Repair::create([
        'code' => Repair::generateCode(),
        'technician_id' => $technician->id,
        'title' => 'iPhone 12, cracked screen',
        ...$attributes,
    ]);

    $repair->updates()->create(['status' => $repair->status]);

    return $repair;
}

// ------------------------------------------------------------ starting to track

test('a technician can start tracking a repair and gets its page and link', function () {
    $technician = repairTechnician();

    $response = $this->actingAs($technician)
        ->post(route('technician.repairs.store'), ['title' => 'iPhone 12, cracked screen', 'description' => 'Screen only'])
        ->assertSessionHasNoErrors();

    $repair = Repair::sole();

    $response->assertRedirect(route('repairs.show', $repair));

    expect($repair->technician_id)->toBe($technician->id)
        ->and($repair->customer_id)->toBeNull()
        ->and($repair->status)->toBe('received')
        ->and($repair->code)->toMatch('/^REP-[A-Z2-9]{8}$/')
        // The timeline starts with the drop-off.
        ->and($repair->updates)->toHaveCount(1)
        ->and($repair->updates->first()->status)->toBe('received');
});

test('a customer the technician talks to can be linked, and is told', function () {
    Notification::fake();

    $technician = repairTechnician();
    $customer = repairCustomer();
    repairChat($customer, $technician);

    $this->actingAs($technician)
        ->post(route('technician.repairs.store'), ['title' => 'Laptop', 'customer_id' => $customer->id])
        ->assertSessionHasNoErrors();

    expect(Repair::sole()->customer_id)->toBe($customer->id);

    Notification::assertSentTo($customer, RepairUpdated::class, fn ($n) => $n->event === 'started');
});

test('a repair cannot be linked to a customer the technician has no conversation with', function () {
    $technician = repairTechnician();
    $stranger = repairCustomer();

    $this->actingAs($technician)
        ->post(route('technician.repairs.store'), ['title' => 'Laptop', 'customer_id' => $stranger->id])
        ->assertSessionHasErrors('customer_id');

    expect(Repair::count())->toBe(0);
});

test('only technicians can manage repairs', function () {
    $customer = repairCustomer();
    $repair = repairFor(repairTechnician());

    $this->actingAs($customer)->get(route('technician.repairs.index'))->assertForbidden();
    $this->actingAs($customer)->post(route('technician.repairs.store'), ['title' => 'Laptop'])->assertForbidden();
    $this->actingAs($customer)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'ready'])
        ->assertForbidden();

    expect($repair->fresh()->status)->toBe('received');
});

// ---------------------------------------------------------------- the updates

test('posting an update changes the status, lands on the timeline and tells the customer', function () {
    Notification::fake();

    $technician = repairTechnician();
    $customer = repairCustomer();
    repairChat($customer, $technician);
    $repair = repairFor($technician, ['customer_id' => $customer->id]);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'ready', 'note' => 'Come and get it'])
        ->assertSessionHasNoErrors();

    $repair->refresh();

    expect($repair->status)->toBe('ready')
        ->and($repair->updates)->toHaveCount(2)
        // Newest first.
        ->and($repair->updates->first()->status)->toBe('ready')
        ->and($repair->updates->first()->note)->toBe('Come and get it');

    Notification::assertSentTo(
        $customer,
        RepairUpdated::class,
        fn ($n) => $n->event === 'status' && $n->status === 'ready' && $n->note === 'Come and get it',
    );
});

test('a note alone is an update too', function () {
    Notification::fake();

    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id]);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'received', 'note' => 'Part ordered'])
        ->assertSessionHasNoErrors();

    expect($repair->fresh()->status)->toBe('received')
        ->and($repair->updates()->count())->toBe(2);

    Notification::assertSentTo($customer, RepairUpdated::class, fn ($n) => $n->event === 'note');
});

test('an update that changes nothing is refused, and so is an unknown status', function () {
    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'received'])
        ->assertSessionHasErrors('note');

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'teleported'])
        ->assertSessionHasErrors('status');

    expect($repair->updates()->count())->toBe(1);
});

test('nobody else\'s repair can be updated, edited or deleted', function () {
    $owner = repairTechnician();
    $other = repairTechnician();
    $repair = repairFor($owner);

    $this->actingAs($other)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'ready'])
        ->assertNotFound();
    $this->actingAs($other)
        ->put(route('technician.repairs.update', $repair), ['title' => 'Mine now'])
        ->assertNotFound();
    $this->actingAs($other)->delete(route('technician.repairs.destroy', $repair))->assertNotFound();

    expect($repair->fresh()->status)->toBe('received')
        ->and($repair->fresh()->title)->toBe('iPhone 12, cracked screen');
});

test('the details can be edited, and linking a customer later tells them', function () {
    Notification::fake();

    $technician = repairTechnician();
    $customer = repairCustomer();
    repairChat($customer, $technician);
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->put(route('technician.repairs.update', $repair), [
            'title' => 'iPhone 12, new battery too',
            'description' => 'Screen and battery',
            'customer_id' => $customer->id,
        ])
        ->assertSessionHasNoErrors();

    expect($repair->fresh()->title)->toBe('iPhone 12, new battery too')
        ->and($repair->fresh()->customer_id)->toBe($customer->id);

    Notification::assertSentTo($customer, RepairUpdated::class, fn ($n) => $n->event === 'started');
});

test('deleting a repair deletes its timeline', function () {
    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->delete(route('technician.repairs.destroy', $repair))
        ->assertRedirect(route('technician.repairs.index'));

    expect(Repair::count())->toBe(0)
        ->and(DB::table('repair_updates')->count())->toBe(0);
});

// --------------------------------------------------------------- following one

test('anyone signed in with the link can follow a repair, but only the technician sees the customer', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Washing machine']);

    $this->actingAs($customer)
        ->get(route('repairs.show', $repair))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Repairs/Show')
            ->where('repair.code', $repair->code)
            ->where('repair.title', 'Washing machine')
            ->where('repair.technician.id', $technician->id)
            ->where('repair.customer', null)
            ->where('isOwner', false)
            ->has('updates', 1)
            ->has('customers', 0));

    $this->actingAs($technician)
        ->get(route('repairs.show', $repair))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('isOwner', true)
            ->where('repair.customer.id', $customer->id));

    // Somebody with only the link is not the customer, and can follow it all the same.
    $this->actingAs(repairCustomer())->get(route('repairs.show', $repair))->assertOk();
});

test('the tracking page needs an account and a real code', function () {
    $repair = repairFor(repairTechnician());

    $this->get(route('repairs.show', $repair))->assertRedirect(route('login'));

    $this->actingAs(repairCustomer())->get('/repairs/REP-NOSUCHCODE')->assertNotFound();
});

test('a customer sees only the repairs linked to their account', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $mine = repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Mine']);
    repairFor($technician, ['title' => 'Somebody else']);

    $this->actingAs($customer)
        ->get(route('repairs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Repairs/Index')
            ->has('repairs.data', 1)
            ->where('repairs.data.0.code', $mine->code)
            ->where('repairs.data.0.technician.name', $technician->name));

    // Technicians have their own list.
    $this->actingAs($technician)->get(route('repairs.index'))->assertRedirect(route('technician.repairs.index'));
});

test('a customer\'s list can be narrowed to the repairs still going or the ones that are over', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Active one']);
    repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Done one', 'status' => 'completed']);
    repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Dropped one', 'status' => 'cancelled']);

    $this->actingAs($customer)
        ->get(route('repairs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filter', 'all')
            ->has('repairs.data', 3)
            ->where('counts', ['all' => 3, 'active' => 1, 'closed' => 2]));

    $this->actingAs($customer)
        ->get(route('repairs.index', ['filter' => 'active']))
        ->assertInertia(fn (Assert $page) => $page->has('repairs.data', 1)->where('repairs.data.0.title', 'Active one'));

    $this->actingAs($customer)
        ->get(route('repairs.index', ['filter' => 'closed']))
        ->assertInertia(fn (Assert $page) => $page->has('repairs.data', 2));
});

test('the technician\'s list separates active repairs from closed ones', function () {
    $technician = repairTechnician();
    repairFor($technician, ['title' => 'Active one']);
    repairFor($technician, ['title' => 'Done one', 'status' => 'completed']);
    repairFor($technician, ['title' => 'Dropped one', 'status' => 'cancelled']);
    repairFor(repairTechnician(), ['title' => 'Not mine']);

    $this->actingAs($technician)
        ->get(route('technician.repairs.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filter', 'active')
            ->has('repairs.data', 1)
            ->where('repairs.data.0.title', 'Active one')
            ->where('counts', ['active' => 1, 'closed' => 2]));

    $this->actingAs($technician)
        ->get(route('technician.repairs.index', ['filter' => 'closed']))
        ->assertInertia(fn (Assert $page) => $page->has('repairs.data', 2));

    $this->actingAs($technician)
        ->get(route('technician.repairs.index', ['filter' => 'all']))
        ->assertInertia(fn (Assert $page) => $page->has('repairs.data', 3));
});

// -------------------------------------------------------------- notifications

test('the customer is notified in the app, and opening the page settles it', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id, 'title' => 'Laptop']);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'in_progress'])
        ->assertSessionHasNoErrors();

    $notification = $customer->unreadNotifications()->sole();

    expect($notification->data['kind'])->toBe('repair')
        ->and($notification->data['title'])->toBe('Laptop is now in progress')
        ->and($notification->data['url'])->toBe(route('repairs.show', $repair, absolute: false));

    $this->actingAs($customer)->get(route('repairs.show', $repair))->assertOk();

    expect($customer->unreadNotifications()->count())->toBe(0);
});

test('the email says what happened without repeating what the technician wrote', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id]);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'ready', 'note' => 'A secret note'])
        ->assertSessionHasNoErrors();

    $mail = (new RepairUpdated($repair->fresh(), 'status', 'ready', 'A secret note'))->toMail($customer);

    expect($mail->subject)->toBe("Repair {$repair->code}: ready for pickup")
        ->and(implode(' ', $mail->introLines))->not->toContain('A secret note')
        ->and($mail->actionUrl)->toBe(route('repairs.show', $repair));
});

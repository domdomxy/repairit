<?php

use App\Models\Conversation;
use App\Models\Repair;
use App\Models\RepairUpdate;
use App\Models\RepairUpdateAttachment;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\RepairGuestUpdated;
use App\Notifications\RepairUpdated;
use Illuminate\Support\Facades\URL;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
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

test('anybody with the link can follow a repair, with or without an account, but the code must be real', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id, 'description' => 'Screen only']);

    // Somebody with no account: a technician tracked a repair for them and gave them the link.
    $this->get(route('repairs.show', $repair))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Repairs/Show')
            ->where('repair.code', $repair->code)
            ->where('repair.description', 'Screen only')
            ->where('repair.technician.name', $technician->name)
            ->missing('repair.technician.id')
            ->where('repair.customer', null)
            ->where('isOwner', false)
            ->where('customers', [])
            ->where('attachmentLimits', null));

    $this->get('/repairs/REP-NOSUCHCODE')->assertNotFound();

    // Signed in, it is the same page.
    $this->actingAs(repairCustomer())->get(route('repairs.show', $repair))->assertOk();
});

test('following a repair with only the link gives no way to manage it, or to see anybody\'s list', function () {
    $repair = repairFor(repairTechnician());

    $this->post(route('technician.repairs.updates.store', $repair), ['status' => 'ready', 'note' => 'Hacked'])
        ->assertRedirect(route('login'));
    $this->put(route('technician.repairs.update', $repair), ['title' => 'Hacked'])->assertRedirect(route('login'));
    $this->delete(route('technician.repairs.destroy', $repair))->assertRedirect(route('login'));
    $this->get(route('repairs.index'))->assertRedirect(route('login'));

    expect($repair->fresh()->title)->not->toBe('Hacked')
        ->and($repair->updates()->count())->toBe(1);
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

// ------------------------------------------------------------------- files on an update

test('a technician can attach files to an update, and they show on the timeline', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'note' => 'Photos and the invoice',
            'attachments' => [
                UploadedFile::fake()->create('screen.jpg', 50, 'image/jpeg'),
                UploadedFile::fake()->create('invoice.pdf', 80, 'application/pdf'),
            ],
        ])
        ->assertSessionHasNoErrors();

    $update = $repair->updates()->first();

    expect($update->attachments)->toHaveCount(2)
        ->and($update->attachments->pluck('name')->all())->toBe(['screen.jpg', 'invoice.pdf']);

    foreach ($update->attachments as $attachment) {
        Storage::disk(RepairUpdate::ATTACHMENT_DISK)->assertExists($attachment->path);
    }

    $this->actingAs($technician)
        ->get(route('repairs.show', $repair))
        ->assertInertia(fn (Assert $page) => $page
            ->has('updates.0.attachments', 2)
            ->where('updates.0.attachments.0.name', 'screen.jpg')
            ->where('updates.0.attachments.0.is_image', true)
            ->where('updates.0.attachments.1.is_pdf', true)
            ->missing('updates.0.attachments.0.path')
            ->where('attachmentLimits.max_files', RepairUpdate::ATTACHMENT_MAX_FILES));
});

test('an update may be only files, and the customer is told', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id]);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'received',
            'attachments' => [UploadedFile::fake()->create('before.png', 20, 'image/png')],
        ])
        ->assertSessionHasNoErrors();

    expect($repair->updates()->count())->toBe(2)
        ->and($repair->updates()->first()->attachments)->toHaveCount(1)
        ->and($customer->unreadNotifications()->count())->toBe(1);
});

test('files the server does not allow, or too many of them, are refused and nothing is saved', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'attachments' => [UploadedFile::fake()->create('run.exe', 10, 'application/x-msdownload')],
        ])
        ->assertSessionHasErrors('attachments.0');

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'attachments' => array_map(
                fn ($i) => UploadedFile::fake()->create("photo-{$i}.jpg", 10, 'image/jpeg'),
                range(1, RepairUpdate::ATTACHMENT_MAX_FILES + 1),
            ),
        ])
        ->assertSessionHasErrors('attachments');

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'attachments' => [UploadedFile::fake()->create('huge.pdf', RepairUpdate::ATTACHMENT_MAX_KB + 1, 'application/pdf')],
        ])
        ->assertSessionHasErrors('attachments.0');

    expect($repair->updates()->count())->toBe(1)
        ->and(RepairUpdateAttachment::count())->toBe(0)
        ->and(Storage::disk(RepairUpdate::ATTACHMENT_DISK)->allFiles())->toBe([]);
});

test('only the repair\'s technician can attach files', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $repair = repairFor(repairTechnician());

    $this->actingAs(repairTechnician())
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'attachments' => [UploadedFile::fake()->create('a.jpg', 10, 'image/jpeg')],
        ])
        ->assertNotFound();

    $this->actingAs(repairCustomer())
        ->post(route('technician.repairs.updates.store', $repair), [
            'status' => 'ready',
            'attachments' => [UploadedFile::fake()->create('a.jpg', 10, 'image/jpeg')],
        ])
        ->assertForbidden();

    expect(RepairUpdateAttachment::count())->toBe(0);
});

test('whoever has the repair link can open its files, and only through that repair', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id]);
    $other = repairFor($technician);

    $this->actingAs($technician)->post(route('technician.repairs.updates.store', $repair), [
        'status' => 'ready',
        'attachments' => [
            UploadedFile::fake()->create('invoice.pdf', 10, 'application/pdf'),
            UploadedFile::fake()->create('notes.docx', 10, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ],
    ]);

    [$pdf, $doc] = $repair->updates()->first()->attachments->all();

    // A PDF opens in the page; anything else is forced to download.
    $this->actingAs($customer)
        ->get(route('repairs.attachment', [$repair, $pdf->id]))
        ->assertOk()
        ->assertHeader('X-Content-Type-Options', 'nosniff')
        ->assertHeader('Content-Type', 'application/pdf');

    expect($this->actingAs($customer)->get(route('repairs.attachment', [$repair, $pdf->id]))->headers->get('Content-Disposition'))
        ->toStartWith('inline');

    expect($this->actingAs($customer)->get(route('repairs.attachment', [$repair, $doc->id]))->headers->get('Content-Disposition'))
        ->toStartWith('attachment');

    // Another repair's code does not open this repair's file.
    $this->actingAs($customer)
        ->get(route('repairs.attachment', [$other, $pdf->id]))
        ->assertNotFound();

    // Somebody with only the link opens it too, but still only through this repair.
    $this->app['auth']->forgetGuards();

    $this->get(route('repairs.attachment', [$repair, $pdf->id]))->assertOk();
    $this->get(route('repairs.attachment', [$other, $pdf->id]))->assertNotFound();
});

test('deleting a repair removes its files from the disk', function () {
    Storage::fake(RepairUpdate::ATTACHMENT_DISK);

    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)->post(route('technician.repairs.updates.store', $repair), [
        'status' => 'ready',
        'attachments' => [UploadedFile::fake()->create('a.jpg', 10, 'image/jpeg')],
    ]);

    expect(Storage::disk(RepairUpdate::ATTACHMENT_DISK)->allFiles())->toHaveCount(1);

    $this->actingAs($technician)->delete(route('technician.repairs.destroy', $repair))->assertRedirect();

    expect(Storage::disk(RepairUpdate::ATTACHMENT_DISK)->allFiles())->toBe([])
        ->and(RepairUpdateAttachment::count())->toBe(0);
});

// ------------------------------------------------------------------------- searching

test('a technician can search their repairs by title, code or customer name', function () {
    $technician = repairTechnician();
    $sara = User::factory()->create(['role' => 'customer', 'name' => 'Sara Trabelsi']);

    $phone = repairFor($technician, ['title' => 'iPhone 12, cracked screen']);
    $laptop = repairFor($technician, ['title' => 'Laptop keyboard', 'customer_id' => $sara->id]);
    repairFor(repairTechnician(), ['title' => 'iPhone of somebody else']);

    $search = fn (string $q) => $this->actingAs($technician)->get(route('technician.repairs.index', ['filter' => 'all', 'q' => $q]));

    $search('iphone')->assertInertia(fn (Assert $page) => $page
        ->has('repairs.data', 1)
        ->where('repairs.data.0.code', $phone->code)
        ->where('filters.q', 'iphone'));

    $search('Trabelsi')->assertInertia(fn (Assert $page) => $page
        ->has('repairs.data', 1)
        ->where('repairs.data.0.code', $laptop->code));

    $search(substr($phone->code, 0, 8))->assertInertia(fn (Assert $page) => $page
        ->where('repairs.data.0.code', $phone->code));

    $search('nothing like this')->assertInertia(fn (Assert $page) => $page->has('repairs.data', 0));

    // No search: everything of theirs, and none of anybody else's.
    $this->actingAs($technician)
        ->get(route('technician.repairs.index', ['filter' => 'all']))
        ->assertInertia(fn (Assert $page) => $page->has('repairs.data', 2)->where('filters.q', ''));
});

test('a customer can search their repairs by title, code or technician name', function () {
    $customer = repairCustomer();
    $amine = repairTechnician();
    $amine->update(['name' => 'Amine Ben Salah']);
    $other = repairTechnician();

    $screen = repairFor($amine, ['title' => 'Cracked screen', 'customer_id' => $customer->id]);
    $battery = repairFor($other, ['title' => 'Battery swap', 'customer_id' => $customer->id]);
    repairFor($amine, ['title' => 'Cracked screen of another customer']);

    $search = fn (string $q) => $this->actingAs($customer)->get(route('repairs.index', ['q' => $q]));

    $search('cracked')->assertInertia(fn (Assert $page) => $page
        ->has('repairs.data', 1)
        ->where('repairs.data.0.code', $screen->code));

    $search('Ben Salah')->assertInertia(fn (Assert $page) => $page
        ->has('repairs.data', 1)
        ->where('repairs.data.0.code', $screen->code));

    $search($battery->code)->assertInertia(fn (Assert $page) => $page
        ->has('repairs.data', 1)
        ->where('repairs.data.0.code', $battery->code));

    $search('zzz')->assertInertia(fn (Assert $page) => $page->has('repairs.data', 0));
});

// ------------------------------------------------------- the welcome page's tracking box

test('the welcome page takes a code, or a whole link, to the tracking page without an account', function () {
    $repair = repairFor(repairTechnician());
    $letters = substr($repair->code, 4);

    $this->get('/')->assertOk()->assertInertia(fn (Assert $page) => $page->component('Welcome'));

    foreach ([
        $repair->code,
        strtolower($repair->code),
        "  {$repair->code}  ",
        $letters,
        route('repairs.show', $repair),
        route('repairs.show', $repair).'/?utm=x',
    ] as $typed) {
        $this->post(route('repairs.lookup'), ['code' => $typed])->assertRedirect(route('repairs.show', $repair));
    }
});

test('a code that does not exist is said so on the box', function () {
    repairFor(repairTechnician());

    foreach (['REP-AAAAAAAA', 'nonsense', 'REP-123', 'https://example.com/repairs/REP-AAAAAAAA'] as $typed) {
        $this->post(route('repairs.lookup'), ['code' => $typed])->assertSessionHasErrors('code');
    }

    $this->post(route('repairs.lookup'), ['code' => ''])->assertSessionHasErrors('code');
});

// ------------------------------------------------------------ email for updates (guests)

test('somebody with just the link can leave an email, which is never shown in full', function () {
    Notification::fake();
    $repair = repairFor(repairTechnician());

    $this->put(route('repairs.email.update', $repair), ['email' => ' Jane.Doe@Example.com '])
        ->assertSessionHasNoErrors();

    expect($repair->fresh()->guest_email)->toBe('jane.doe@example.com');

    Notification::assertSentOnDemand(RepairGuestUpdated::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'jane.doe@example.com' && $n->event === 'subscribed');

    $this->get(route('repairs.show', $repair))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailFollow.email', 'j*******@example.com')
            ->missing('repair.guest_email'));
});

test('the email can be changed, and only a new address gets the confirmation', function () {
    Notification::fake();
    $repair = repairFor(repairTechnician(), ['guest_email' => 'old@example.com']);

    // The same address again is not a change.
    $this->put(route('repairs.email.update', $repair), ['email' => 'old@example.com']);
    Notification::assertNothingSent();

    $this->put(route('repairs.email.update', $repair), ['email' => 'new@example.com']);

    expect($repair->fresh()->guest_email)->toBe('new@example.com');
    Notification::assertSentOnDemand(RepairGuestUpdated::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'new@example.com');
});

test('an invalid email is refused', function () {
    $repair = repairFor(repairTechnician());

    $this->put(route('repairs.email.update', $repair), ['email' => 'not-an-email'])
        ->assertSessionHasErrors('email');

    expect($repair->fresh()->guest_email)->toBeNull();
});

test('the email can be removed at any time', function () {
    $repair = repairFor(repairTechnician(), ['guest_email' => 'jane@example.com']);

    $this->delete(route('repairs.email.destroy', $repair))->assertRedirect();

    expect($repair->fresh()->guest_email)->toBeNull();
});

test('saving or removing the email does not move the repair up the technician\'s list', function () {
    $repair = repairFor(repairTechnician());
    $repair->forceFill(['updated_at' => now()->subDay()])->saveQuietly();
    $before = $repair->fresh()->updated_at;

    $this->put(route('repairs.email.update', $repair), ['email' => 'jane@example.com']);

    expect($repair->fresh()->updated_at->equalTo($before))->toBeTrue();
});

test('the guest is emailed when the status changes or a note is added, without what was written', function () {
    Notification::fake();
    $technician = repairTechnician();
    $repair = repairFor($technician, ['guest_email' => 'jane@example.com']);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'diagnosing', 'note' => 'Secret detail'])
        ->assertSessionHasNoErrors();

    Notification::assertSentOnDemand(RepairGuestUpdated::class, function ($n, $channels, $notifiable) {
        $mail = $n->toMail($notifiable);

        return $notifiable->routes['mail'] === 'jane@example.com'
            && $n->event === 'status'
            && ! str_contains(implode(' ', $mail->introLines).$mail->subject, 'Secret detail');
    });

    $this->post(route('technician.repairs.updates.store', $repair), ['status' => 'diagnosing', 'note' => 'One more thing']);

    Notification::assertSentOnDemand(RepairGuestUpdated::class, fn ($n) => $n->event === 'note');
});

test('nobody is emailed when no address was left', function () {
    Notification::fake();
    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->post(route('technician.repairs.updates.store', $repair), ['status' => 'diagnosing']);

    Notification::assertNothingSent();
});

test('the link in an email removes the address it was sent to, and only that one', function () {
    $repair = repairFor(repairTechnician(), ['guest_email' => 'jane@example.com']);

    $stale = URL::signedRoute('repairs.email.unsubscribe', ['repair' => $repair, 'h' => hash('sha256', 'other@example.com')]);
    $link = URL::signedRoute('repairs.email.unsubscribe', ['repair' => $repair, 'h' => hash('sha256', 'jane@example.com')]);

    // An email sent to an earlier address cannot remove the current one.
    $this->get($stale)->assertRedirect(route('repairs.show', $repair));
    expect($repair->fresh()->guest_email)->toBe('jane@example.com');

    $this->get($link)->assertRedirect(route('repairs.show', $repair));
    expect($repair->fresh()->guest_email)->toBeNull();
});

test('the unsubscribe link must be signed', function () {
    $repair = repairFor(repairTechnician(), ['guest_email' => 'jane@example.com']);

    $this->get(route('repairs.email.unsubscribe', ['repair' => $repair, 'h' => hash('sha256', 'jane@example.com')]))
        ->assertForbidden();

    expect($repair->fresh()->guest_email)->toBe('jane@example.com');
});

test('the technician and the linked customer do not get the email option', function () {
    $technician = repairTechnician();
    $customer = repairCustomer();
    $repair = repairFor($technician, ['customer_id' => $customer->id]);

    $this->actingAs($technician)->get(route('repairs.show', $repair))
        ->assertInertia(fn (Assert $page) => $page->where('emailFollow', null));
    $this->actingAs($customer)->get(route('repairs.show', $repair))
        ->assertInertia(fn (Assert $page) => $page->where('emailFollow', null));

    $this->actingAs($technician)->put(route('repairs.email.update', $repair), ['email' => 'a@example.com'])->assertForbidden();
    $this->actingAs($customer)->put(route('repairs.email.update', $repair), ['email' => 'a@example.com'])->assertForbidden();
});

// ------------------------------------------------------------ toasts (flash sharing)

test('a message flashed after an action is shared with the page, with an id to show it only once', function () {
    $technician = repairTechnician();
    $repair = repairFor($technician);

    $this->actingAs($technician)
        ->withSession(['success' => 'Update posted.', 'error' => 'Something went wrong.'])
        ->get(route('repairs.show', $repair))
        ->assertInertia(fn (Assert $page) => $page
            ->where('flash.success', 'Update posted.')
            ->where('flash.error', 'Something went wrong.')
            ->has('flash.id'));

    // Nothing flashed: no flash at all, so no toast.
    $this->actingAs($technician)
        ->get(route('repairs.show', $repair))
        ->assertInertia(fn (Assert $page) => $page->where('flash', null));
});

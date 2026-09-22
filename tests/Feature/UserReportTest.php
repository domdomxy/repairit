<?php

use App\Models\Offer;
use App\Models\Report;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

test('a person can be reported: admins are told and the report points at nothing but the person', function () {
    Notification::fake();

    $reported = User::factory()->create(['role' => 'technician']);
    $reporter = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($reporter)
        ->post(route('users.report', $reported), ['reason' => 'harassment', 'details' => 'Keeps insulting people'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->reporter_id)->toBe($reporter->id)
        ->and($report->reported_user_id)->toBe($reported->id)
        ->and($report->conversation_id)->toBeNull()
        ->and($report->message_id)->toBeNull()
        ->and($report->offer_id)->toBeNull()
        ->and($report->service_request_id)->toBeNull()
        ->and($report->isUserReport())->toBeTrue()
        ->and($report->isOfferReport())->toBeFalse()
        ->and($report->type())->toBe('user')
        ->and($report->targetLabel())->toBe('a user')
        ->and($report->details)->toBe('Keeps insulting people')
        ->and($report->status)->toBe('open');

    Notification::assertSentTo($admin, NewReport::class);
    Notification::assertNotSentTo($reported, NewReport::class);
});

test('technicians can report customers and the other way round', function () {
    $technician = User::factory()->create(['role' => 'technician']);
    $customer = User::factory()->create(['role' => 'customer']);

    $this->actingAs($technician)->post(route('users.report', $customer), ['reason' => 'fraud'])->assertRedirect();
    $this->actingAs($customer)->post(route('users.report', $technician), ['reason' => 'spam'])->assertRedirect();

    expect(Report::count())->toBe(2)
        ->and(Report::where('reporter_id', $technician->id)->sole()->reported_user_id)->toBe($customer->id);
});

test('reporting the same person twice does not file a second report, but another person is a new one', function () {
    $reporter = User::factory()->create(['role' => 'customer']);
    $first = User::factory()->create(['role' => 'technician']);
    $second = User::factory()->create(['role' => 'technician']);

    $this->actingAs($reporter)->post(route('users.report', $first), ['reason' => 'spam']);
    $this->actingAs($reporter)->post(route('users.report', $first), ['reason' => 'spam']);

    expect(Report::count())->toBe(1);

    $this->actingAs($reporter)->post(route('users.report', $second), ['reason' => 'spam']);

    expect(Report::count())->toBe(2);
});

test('a report about a person is not mistaken for one about their offer', function () {
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);
    $offer = Offer::create(['technician_id' => $technician->id, 'title' => 'Boiler service']);
    $reporter = User::factory()->create(['role' => 'customer']);

    $this->actingAs($reporter)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $this->actingAs($reporter)->post(route('users.report', $technician), ['reason' => 'spam']);

    expect(Report::count())->toBe(2)
        ->and(Report::where('user_report', true)->sole()->type())->toBe('user')
        ->and(Report::where('user_report', false)->sole()->type())->toBe('offer');
});

test('you cannot report yourself or an admin, or use an unknown reason', function () {
    $user = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);
    $other = User::factory()->create(['role' => 'technician']);

    $this->actingAs($user)->post(route('users.report', $user), ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($user)->post(route('users.report', $admin), ['reason' => 'spam'])->assertNotFound();
    $this->actingAs($user)->post(route('users.report', $other), ['reason' => 'nonsense'])->assertSessionHasErrors('reason');

    expect(Report::count())->toBe(0);
});

test('reporting a person needs a signed in user', function () {
    $person = User::factory()->create(['role' => 'technician']);

    $this->post(route('users.report', $person), ['reason' => 'spam'])->assertRedirect(route('login'));

    expect(Report::count())->toBe(0);
});

test('the profile pages and the chat send the reasons for the person report form', function () {
    $technician = User::factory()->create(['role' => 'technician']);
    $customer = User::factory()->create(['role' => 'customer']);

    $this->actingAs($customer)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.harassment'));

    $this->actingAs($technician)
        ->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.harassment'));
});

test('an admin sees a person report, with no conversation or post, and other reports about the same person', function () {
    $reported = User::factory()->create(['role' => 'technician']);
    $first = User::factory()->create(['role' => 'customer']);
    $second = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($first)->post(route('users.report', $reported), ['reason' => 'harassment']);
    $this->actingAs($second)->post(route('users.report', $reported), ['reason' => 'fraud']);

    $this->actingAs($admin)
        ->get(route('admin.reports.show', Report::orderBy('id')->first()))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Show')
            ->where('report.type', 'user')
            ->where('report.reported.id', $reported->id)
            ->where('offer', null)
            ->where('serviceRequest', null)
            ->where('review', null)
            ->has('messages', 0)
            ->has('related', 1));

    $this->actingAs($admin)
        ->get(route('admin.reports.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('reports.data.0.type', 'user'));
});

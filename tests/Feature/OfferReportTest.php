<?php

use App\Models\Offer;
use App\Models\Report;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewReport;
use App\Notifications\ReportAcknowledged;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => Storage::fake(Offer::MEDIA_DISK));

/** @return array{0: User, 1: Offer} [technician, offer] */
function reportableOffer(string $title = 'Boiler service'): array
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return [$technician, Offer::create(['technician_id' => $technician->id, 'title' => $title])];
}

test('an offer can be reported: admins are told and the report has no conversation', function () {
    Notification::fake();

    [$technician, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)
        ->post(route('offers.report', $offer), ['reason' => 'fraud', 'details' => 'Asks for money upfront'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->reporter_id)->toBe($customer->id)
        ->and($report->reported_user_id)->toBe($technician->id)
        ->and($report->conversation_id)->toBeNull()
        ->and($report->message_id)->toBeNull()
        ->and($report->offer_id)->toBe($offer->id)
        ->and($report->offer_title)->toBe('Boiler service')
        ->and($report->type())->toBe('offer')
        ->and($report->status)->toBe('open');

    Notification::assertSentTo($admin, NewReport::class);
    Notification::assertNotSentTo($technician, NewReport::class);
});

test('reporting the same offer twice does not file a second report', function () {
    [, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);

    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam']);

    expect(Report::count())->toBe(1);
});

test('you cannot report your own offer, or use an unknown reason', function () {
    [$technician, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);

    $this->actingAs($technician)->post(route('offers.report', $offer), ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'nonsense'])->assertSessionHasErrors('reason');

    expect(Report::count())->toBe(0);
});

test('the offers pages send the reasons for the report form', function () {
    [, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);

    $this->actingAs($customer)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.spam'));

    $this->actingAs($customer)
        ->get(route('offers.show', $offer))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.fraud'));
});

test('an admin sees the reported offer, and the report survives the offer being deleted', function () {
    [, $offer] = reportableOffer('Cheap fix');
    $customer = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Show')
            ->where('report.type', 'offer')
            ->where('offer.title', 'Cheap fix')
            ->where('offer.card.id', $offer->id)
            ->has('messages', 0));

    $offer->delete();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('offer.title', 'Cheap fix')
            ->where('offer.card', null));

    $this->actingAs($admin)
        ->get(route('admin.reports.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('reports.data.0.type', 'offer'));
});

// ------------------------------------------------------------ the reporter's own page

test('a reporter can follow their report on a page, and the notification links to it', function () {
    Notification::fake();

    [$technician, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);
    User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam', 'details' => 'Posted it three times']);

    $report = Report::sole();

    // What the reporter was told is kept on the report, as worded then.
    expect($report->reporter_ack_text)->not->toBeNull();

    Notification::assertSentTo($customer, ReportAcknowledged::class, fn ($n) => $n->toArray($customer)['url'] === route('reports.mine.show', $report, absolute: false));

    $this->actingAs($customer)->get(route('reports.mine.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Reports/Index')
            ->has('reports.data', 1)
            ->where('reports.data.0.status_label', 'Under review')
            ->where('reports.data.0.target_label', 'an offer'));

    $this->actingAs($customer)->get(route('reports.mine.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Reports/Show')
            ->where('report.details', 'Posted it three times')
            ->where('report.timeline.0.text', $report->reporter_ack_text)
            ->where('report.timeline.1.state', 'current')
            ->where('report.timeline.2.state', 'upcoming'));
});

test('closing a report shows the outcome and the closing message on the reporter\'s page, and nothing the admin wrote', function () {
    Notification::fake();

    [$technician, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($admin)->post(route('admin.reports.status', $report), ['status' => 'resolved', 'note' => 'Removed the offer, warned the technician']);

    $report->refresh();
    expect($report->reporter_closure_text)->not->toBeNull();

    $response = $this->actingAs($customer)->get(route('reports.mine.show', $report))
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.status_label', 'Resolved')
            ->where('report.timeline.2.state', 'done')
            ->where('report.timeline.2.text', $report->reporter_closure_text)
            ->missing('report.resolution_note')
            ->missing('report.reviewer'));

    expect(json_encode($response->viewData('page')['props']))->not->toContain('warned the technician');
});

test('nobody can open somebody else\'s report page, and it lists only my own', function () {
    Notification::fake();

    [, $offer] = reportableOffer();
    $reporter = User::factory()->create(['role' => 'customer']);
    $other = User::factory()->create(['role' => 'customer']);
    User::factory()->create(['role' => 'admin']);

    $this->actingAs($reporter)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($other)->get(route('reports.mine.show', $report))->assertNotFound();
    $this->actingAs($other)->get(route('reports.mine.index'))
        ->assertInertia(fn (Assert $page) => $page->has('reports.data', 0));

    app('auth')->forgetGuards();
    $this->get(route('reports.mine.show', $report))->assertRedirect(route('login'));
});

test('opening the report page settles its notifications', function () {
    [, $offer] = reportableOffer();
    $customer = User::factory()->create(['role' => 'customer']);
    User::factory()->create(['role' => 'admin']);

    $this->actingAs($customer)->post(route('offers.report', $offer), ['reason' => 'spam']);
    $report = Report::sole();

    $customer->refresh();
    expect($customer->unreadNotifications()->where('type', ReportAcknowledged::class)->count())->toBe(1);

    $this->actingAs($customer)->get(route('reports.mine.show', $report));

    expect($customer->unreadNotifications()->where('type', ReportAcknowledged::class)->count())->toBe(0);
});

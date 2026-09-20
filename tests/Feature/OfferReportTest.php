<?php

use App\Models\Offer;
use App\Models\Report;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewReport;
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
        ->get(route('offers.index'))
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

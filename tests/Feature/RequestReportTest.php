<?php

use App\Models\Report;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => $this->withoutVite());

/** @return array{0: User, 1: ServiceRequest} [customer, request] */
function reportableRequest(string $text = 'Cracked phone screen'): array
{
    $customer = User::factory()->create(['role' => 'customer']);

    return [$customer, $customer->serviceRequests()->create([
        'description' => $text,
    ])];
}

test('a request can be reported: admins are told and the report has no conversation', function () {
    Notification::fake();

    [$owner, $serviceRequest] = reportableRequest();
    $technician = User::factory()->create(['role' => 'technician']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($technician)
        ->post(route('requests.report', $serviceRequest), ['reason' => 'spam', 'details' => 'Advertises a shop'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->reporter_id)->toBe($technician->id)
        ->and($report->reported_user_id)->toBe($owner->id)
        ->and($report->conversation_id)->toBeNull()
        ->and($report->message_id)->toBeNull()
        ->and($report->offer_id)->toBeNull()
        ->and($report->service_request_id)->toBe($serviceRequest->id)
        ->and($report->request_excerpt)->toBe('Cracked phone screen')
        ->and($report->type())->toBe('request')
        ->and($report->isOfferReport())->toBeFalse()
        ->and($report->status)->toBe('open');

    Notification::assertSentTo($admin, NewReport::class);
    Notification::assertNotSentTo($owner, NewReport::class);
});

test('reporting the same request twice does not file a second report', function () {
    [, $serviceRequest] = reportableRequest();
    $reporter = User::factory()->create(['role' => 'customer']);

    $this->actingAs($reporter)->post(route('requests.report', $serviceRequest), ['reason' => 'spam']);
    $this->actingAs($reporter)->post(route('requests.report', $serviceRequest), ['reason' => 'spam']);

    expect(Report::count())->toBe(1);
});

test('you cannot report your own request, or use an unknown reason', function () {
    [$owner, $serviceRequest] = reportableRequest();
    $reporter = User::factory()->create(['role' => 'customer']);

    $this->actingAs($owner)->post(route('requests.report', $serviceRequest), ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($reporter)->post(route('requests.report', $serviceRequest), ['reason' => 'nonsense'])->assertSessionHasErrors('reason');

    expect(Report::count())->toBe(0);
});

test('the request of a suspended customer cannot be reported: it is not shown to anybody', function () {
    [$owner, $serviceRequest] = reportableRequest();
    $owner->forceFill(['suspended_at' => now()])->save();
    $reporter = User::factory()->create(['role' => 'customer']);

    $this->actingAs($reporter)->post(route('requests.report', $serviceRequest), ['reason' => 'spam'])->assertNotFound();

    expect(Report::count())->toBe(0);
});

test('the feed sends the reasons for the request report form', function () {
    reportableRequest();
    $viewer = User::factory()->create(['role' => 'technician']);

    $this->actingAs($viewer)
        ->get(route('feed.index'))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.spam'));
});

test('an admin sees the reported request, and the report survives the request being deleted', function () {
    [, $serviceRequest] = reportableRequest('Cheap fix wanted');
    $reporter = User::factory()->create(['role' => 'technician']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($reporter)->post(route('requests.report', $serviceRequest), ['reason' => 'spam']);
    $report = Report::sole();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Show')
            ->where('report.type', 'request')
            ->where('serviceRequest.excerpt', 'Cheap fix wanted')
            ->where('serviceRequest.card.id', $serviceRequest->id)
            ->where('offer', null)
            ->has('messages', 0));

    $serviceRequest->delete();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.type', 'request')
            ->where('serviceRequest.excerpt', 'Cheap fix wanted')
            ->where('serviceRequest.card', null));

    $this->actingAs($admin)
        ->get(route('admin.reports.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('reports.data.0.type', 'request'));
});

test('other reports about the same request are listed together', function () {
    [, $serviceRequest] = reportableRequest();
    $first = User::factory()->create(['role' => 'customer']);
    $second = User::factory()->create(['role' => 'technician']);
    $admin = User::factory()->create(['role' => 'admin']);

    $this->actingAs($first)->post(route('requests.report', $serviceRequest), ['reason' => 'spam']);
    $this->actingAs($second)->post(route('requests.report', $serviceRequest), ['reason' => 'fraud']);

    $this->actingAs($admin)
        ->get(route('admin.reports.show', Report::orderBy('id')->first()))
        ->assertInertia(fn (Assert $page) => $page->has('related', 1));
});

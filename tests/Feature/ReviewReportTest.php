<?php

use App\Models\AdminLog;
use App\Models\CustomerReview;
use App\Models\Offer;
use App\Models\Report;
use App\Models\Review;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

function rrTechnician(): User
{
    $technician = User::factory()->create(['role' => 'technician']);
    TechnicianProfile::create(['user_id' => $technician->id]);

    return $technician;
}

function rrCustomer(): User
{
    return User::factory()->create(['role' => 'customer']);
}

function rrAdmin(): User
{
    return User::factory()->create(['role' => 'admin']);
}

/** A customer's review of a technician. */
function rrReview(User $customer, User $technician, int $rating = 1, ?string $comment = 'Rude and late.'): Review
{
    return Review::create([
        'customer_id' => $customer->id,
        'technician_id' => $technician->id,
        'rating' => $rating,
        'comment' => $comment,
    ]);
}

/** A technician's review of a customer. */
function rrCustomerReview(User $technician, User $customer, int $rating = 1, ?string $comment = 'Never showed up.'): CustomerReview
{
    return CustomerReview::create([
        'technician_id' => $technician->id,
        'customer_id' => $customer->id,
        'rating' => $rating,
        'comment' => $comment,
    ]);
}

test('a review of a technician can be reported: admins are told and the report keeps a copy', function () {
    Notification::fake();

    $technician = rrTechnician();
    $customer = rrCustomer();
    $admin = rrAdmin();
    $review = rrReview($customer, $technician, 1, 'Scam, avoid.');

    $this->actingAs($technician)
        ->post(route('reviews.report', $review), ['reason' => 'harassment', 'details' => 'I never met this person'])
        ->assertRedirect();

    $report = Report::sole();

    expect($report->reporter_id)->toBe($technician->id)
        ->and($report->reported_user_id)->toBe($customer->id)
        ->and($report->review_id)->toBe($review->id)
        ->and($report->customer_review_id)->toBeNull()
        ->and($report->review_kind)->toBe('technician')
        ->and($report->review_subject_id)->toBe($technician->id)
        ->and($report->review_rating)->toBe(1)
        ->and($report->review_comment)->toBe('Scam, avoid.')
        ->and($report->conversation_id)->toBeNull()
        ->and($report->type())->toBe('review')
        ->and($report->isOfferReport())->toBeFalse()
        ->and($report->status)->toBe('open');

    Notification::assertSentTo($admin, NewReport::class);
    Notification::assertNotSentTo($customer, NewReport::class);
    Notification::assertNotSentTo($technician, NewReport::class);
});

test('a review of a customer can be reported by the customer or by anybody else', function () {
    Notification::fake();

    $technician = rrTechnician();
    $customer = rrCustomer();
    $other = rrCustomer();
    rrAdmin();
    $review = rrCustomerReview($technician, $customer, 1, 'Awful person');

    $this->actingAs($customer)
        ->post(route('customer-reviews.report', $review), ['reason' => 'inappropriate'])
        ->assertRedirect();

    $this->actingAs($other)
        ->post(route('customer-reviews.report', $review), ['reason' => 'spam'])
        ->assertRedirect();

    expect(Report::count())->toBe(2);

    $report = Report::where('reporter_id', $customer->id)->sole();

    expect($report->reported_user_id)->toBe($technician->id)
        ->and($report->customer_review_id)->toBe($review->id)
        ->and($report->review_id)->toBeNull()
        ->and($report->review_kind)->toBe('customer')
        ->and($report->review_subject_id)->toBe($customer->id)
        ->and($report->review_comment)->toBe('Awful person')
        ->and($report->type())->toBe('review');
});

test('you cannot report your own review', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();

    $review = rrReview($customer, $technician);
    $customerReview = rrCustomerReview($technician, $customer);

    $this->actingAs($customer)->post(route('reviews.report', $review), ['reason' => 'spam'])->assertForbidden();
    $this->actingAs($technician)->post(route('customer-reviews.report', $customerReview), ['reason' => 'spam'])->assertForbidden();

    expect(Report::count())->toBe(0);
});

test('an unknown reason is refused, and a suspended person\'s page is not reportable', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();
    $review = rrReview($customer, $technician);

    $this->actingAs($technician)
        ->post(route('reviews.report', $review), ['reason' => 'nonsense'])
        ->assertSessionHasErrors('reason');

    $technician->forceFill(['suspended_at' => now()])->save();

    $this->actingAs(rrCustomer())
        ->post(route('reviews.report', $review), ['reason' => 'spam'])
        ->assertNotFound();

    expect(Report::count())->toBe(0);
});

test('reporting the same review twice files one report, but two reviews file two', function () {
    $technician = rrTechnician();
    $first = rrReview(rrCustomer(), $technician);
    $second = rrReview(rrCustomer(), $technician);

    $this->actingAs($technician)->post(route('reviews.report', $first), ['reason' => 'spam']);
    $this->actingAs($technician)->post(route('reviews.report', $first), ['reason' => 'spam']);

    expect(Report::count())->toBe(1);

    // One open report per thing: a different review is a different thing.
    $this->actingAs($technician)->post(route('reviews.report', $second), ['reason' => 'spam']);

    expect(Report::count())->toBe(2);
});

test('a review report does not stop the same person reporting an offer', function () {
    $technician = rrTechnician();
    $review = rrReview(rrCustomer(), $technician);

    $this->actingAs($technician)->post(route('reviews.report', $review), ['reason' => 'spam']);

    $offer = Offer::create(['technician_id' => rrTechnician()->id, 'title' => 'Cheap fix']);

    $this->actingAs($technician)->post(route('offers.report', $offer), ['reason' => 'spam']);

    expect(Report::count())->toBe(2)
        ->and(Report::where('offer_id', $offer->id)->sole()->type())->toBe('offer');
});

test('the profile pages send the reasons for the report form', function () {
    $this->withoutVite();

    $technician = rrTechnician();
    $customer = rrCustomer();

    $this->actingAs($customer)
        ->get(route('technicians.show', $technician))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.harassment'));

    $this->actingAs($technician)
        ->get(route('customers.show', $customer))
        ->assertInertia(fn (Assert $page) => $page->has('reportReasons.harassment'));
});

test('an admin sees the review as it was reported, and notices when it changed', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();
    $admin = rrAdmin();
    $review = rrReview($customer, $technician, 1, 'Scam, avoid.');

    $this->actingAs($technician)->post(route('reviews.report', $review), ['reason' => 'fraud']);
    $report = Report::sole();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('Admin/Reports/Show')
            ->where('report.type', 'review')
            ->where('review.kind', 'technician')
            ->where('review.rating', 1)
            ->where('review.comment', 'Scam, avoid.')
            ->where('review.subject.id', $technician->id)
            ->where('review.exists', true)
            ->where('review.changed', false)
            ->where('offer', null)
            ->has('messages', 0));

    // The author softens it after being reported: the admin still sees the original.
    $review->update(['rating' => 4, 'comment' => 'Fine actually.']);

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertInertia(fn (Assert $page) => $page
            ->where('review.comment', 'Scam, avoid.')
            ->where('review.changed', true)
            ->where('review.current_rating', 4)
            ->where('review.current_comment', 'Fine actually.'));

    $this->actingAs($admin)
        ->get(route('admin.reports.index'))
        ->assertInertia(fn (Assert $page) => $page->where('reports.data.0.type', 'review'));
});

test('other reports about the same review are listed together', function () {
    $technician = rrTechnician();
    $review = rrReview(rrCustomer(), $technician);
    $admin = rrAdmin();

    $this->actingAs($technician)->post(route('reviews.report', $review), ['reason' => 'spam']);
    $this->actingAs(rrCustomer())->post(route('reviews.report', $review), ['reason' => 'fraud']);

    // A report about another review must not show up here.
    $this->actingAs($technician)->post(route('reviews.report', rrReview(rrCustomer(), $technician)), ['reason' => 'spam']);

    $report = Report::where('reporter_id', $technician->id)->where('review_id', $review->id)->sole();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertInertia(fn (Assert $page) => $page->has('related', 1));
});

test('the report survives the review being deleted', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();
    $admin = rrAdmin();
    $customerReview = rrCustomerReview($technician, $customer, 2, 'Difficult.');

    $this->actingAs($customer)->post(route('customer-reviews.report', $customerReview), ['reason' => 'harassment']);
    $report = Report::sole();

    $customerReview->delete();

    $this->actingAs($admin)
        ->get(route('admin.reports.show', $report))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('report.type', 'review')
            ->where('review.kind', 'customer')
            ->where('review.comment', 'Difficult.')
            ->where('review.subject.id', $customer->id)
            ->where('review.exists', false));
});

test('an admin can delete a reported review, and the technician rating follows', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();
    $admin = rrAdmin();
    $review = rrReview($customer, $technician, 1, 'Scam, avoid.');

    expect($technician->technicianProfile->refresh()->rating_count)->toBe(1);

    $this->actingAs($technician)->post(route('reviews.report', $review), ['reason' => 'fraud']);
    $report = Report::sole();

    $this->actingAs($admin)
        ->delete(route('admin.reports.review.destroy', $report))
        ->assertRedirect();

    expect(Review::count())->toBe(0)
        ->and($technician->technicianProfile->refresh()->rating_count)->toBe(0)
        ->and(AdminLog::where('action', 'review.deleted')->count())->toBe(1);

    // The report itself is kept, with what the review said.
    expect($report->refresh()->review_comment)->toBe('Scam, avoid.')
        ->and($report->review_rating)->toBe(1);

    // Nothing left to delete.
    $this->actingAs($admin)
        ->delete(route('admin.reports.review.destroy', $report))
        ->assertNotFound();
});

test('an admin can delete a reported review of a customer', function () {
    $technician = rrTechnician();
    $customer = rrCustomer();
    $admin = rrAdmin();
    $review = rrCustomerReview($technician, $customer);

    $this->actingAs($customer)->post(route('customer-reviews.report', $review), ['reason' => 'harassment']);

    $this->actingAs($admin)
        ->delete(route('admin.reports.review.destroy', Report::sole()))
        ->assertRedirect();

    expect(CustomerReview::count())->toBe(0);
});

test('only admins can delete a reported review', function () {
    $technician = rrTechnician();
    $review = rrReview(rrCustomer(), $technician);

    $this->actingAs($technician)->post(route('reviews.report', $review), ['reason' => 'spam']);

    $this->actingAs($technician)
        ->delete(route('admin.reports.review.destroy', Report::sole()))
        ->assertForbidden();

    expect(Review::count())->toBe(1);
});

<?php

namespace App\Http\Controllers;

use App\Models\CustomerReview;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A customer's public profile: who they are, the repair requests they posted
 * and what technicians say about them.
 */
class CustomerProfileController extends Controller
{
    /** Longest bio and city a customer can put on their public profile, in characters. */
    public const BIO_MAX_LENGTH = 500;

    public const CITY_MAX_LENGTH = 100;

    /**
     * The page where a customer edits what their public profile shows: a
     * technician's own edit page has the same place (TechnicianProfileController).
     * The picture and the account details are on the account page.
     */
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Customers/EditProfile', [
            'profile' => [
                'bio' => $user->bio,
                'city' => $user->city,
                'bio_max' => self::BIO_MAX_LENGTH,
                'city_max' => self::CITY_MAX_LENGTH,
            ],
        ]);
    }

    /**
     * Save what the public profile shows. Everything here is visible to every
     * signed-in user, and both fields are optional.
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:'.self::BIO_MAX_LENGTH],
            'city' => ['nullable', 'string', 'max:'.self::CITY_MAX_LENGTH],
        ]);

        $request->user()->fill([
            'bio' => filled($validated['bio'] ?? null) ? trim($validated['bio']) : null,
            'city' => filled($validated['city'] ?? null) ? trim($validated['city']) : null,
        ])->save();

        return Redirect::route('customer.profile.edit');
    }

    public function show(Request $request, User $customer): Response
    {
        abort_unless($customer->role === 'customer' && ! $customer->isSuspended(), 404);

        $viewer = $request->user();

        $stats = CustomerReview::where('customer_id', $customer->id)
            ->selectRaw('COUNT(*) as total, AVG(rating) as average')
            ->first();

        $reviews = CustomerReview::where('customer_id', $customer->id)
            ->with('technician:id,name,avatar_path')
            ->latest()
            ->latest('id')
            ->get()
            ->map(fn (CustomerReview $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'technician' => [
                    'id' => $review->technician->id,
                    'name' => $review->technician->name,
                    'avatar_url' => $review->technician->avatar_url,
                ],
            ])
            ->values()
            ->all();

        $isTechnician = $viewer->role === 'technician';
        $isOwner = $viewer->is($customer);

        return Inertia::render('Customers/Show', [
            // Only what is meant to be public: never the email or anything else. The bio and
            // city are there only because the customer chose to fill them in.
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'avatar_url' => $customer->avatar_url,
                'bio' => $customer->bio,
                'city' => $customer->city,
                'member_since' => $customer->created_at?->toIso8601String(),
                'rating_count' => (int) $stats->total,
                'rating_avg' => $stats->total ? round((float) $stats->average, 2) : null,
                'reviews' => $reviews,
            ],
            'requests' => ServiceRequestController::profileCards($customer, $viewer),
            // What the "Create a new request" panel needs: only on your own profile.
            'requestForm' => $isOwner
                ? ServiceRequestController::formProps() + ['defaultCity' => $customer->city]
                : null,
            // Whether the viewer has earned the right to rate (see CustomerReview::conversationFor);
            // `myReview` prefills the form.
            // The reasons the report form on each review offers.
            'reportReasons' => Report::REASONS,
            'canReview' => $isTechnician && CustomerReview::conversationFor($viewer, $customer) !== null,
            'myReview' => $isTechnician
                ? CustomerReview::where('technician_id', $viewer->id)
                    ->where('customer_id', $customer->id)
                    ->first(['rating', 'comment'])
                : null,
        ]);
    }
}

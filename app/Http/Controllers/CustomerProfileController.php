<?php

namespace App\Http\Controllers;

use App\Models\CustomerReview;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

/** A customer's public profile: who they are and what technicians say about them. */
class CustomerProfileController extends Controller
{
    public function show(Request $request, User $customer)
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

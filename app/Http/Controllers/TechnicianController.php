<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use App\Support\ProfileLinks;
use Illuminate\Http\Request;
use Inertia\Inertia;

class TechnicianController extends Controller
{
    public function show(Request $request, User $technician)
    {
        abort_unless($technician->role === 'technician' && ! $technician->isSuspended(), 404);
        // Someone who blocked you does not exist as far as you are concerned.
        abort_if($technician->hasBlocked($request->user()), 404);

        $technician->load([
            'technicianProfile.categories',
            'offers' => fn ($q) => $q->latest()->latest('id')->with(['media', 'categories']),
            'reviewsReceived' => fn ($q) => $q->latest()->with('customer:id,name,avatar_path,role'),
        ]);

        // Any account can act as a customer, so anyone who has exchanged
        // messages with this technician may review them. `canReview` says
        // whether the viewer has earned that (see Review::conversationFor);
        // `myReview` prefills the form.
        $viewer = $request->user();

        return Inertia::render('Technicians/Show', [
            'technician' => $this->detail($technician),
            // The requests the technician posted (anyone can post one), listed with their offers.
            'requests' => ServiceRequestController::profileCards($technician, $viewer),
            // The forms' options, only for the technician looking at their own profile.
            'offerForm' => $viewer->is($technician) ? TechnicianOfferController::formProps() : null,
            'requestForm' => $viewer->is($technician)
                ? ServiceRequestController::formProps() + ['defaultCity' => $technician->technicianProfile?->city]
                : null,
            // The reasons the report form on each review offers.
            'reportReasons' => Report::REASONS,
            // What the viewer did about this technician (null on their own profile, and for admins).
            'relations' => $viewer->is($technician) ? null : $viewer->relationFlagsFor($technician),
            'canReview' => Review::conversationFor($viewer, $technician) !== null,
            'myReview' => Review::where('customer_id', $viewer->id)
                ->where('technician_id', $technician->id)
                ->first(['rating', 'comment']),
        ]);
    }

    /**
     * The public card shown in search results (see SearchController).
     *
     * Technicians are never sent to the browser as raw models: that would ship
     * their email, phone, street address and exact coordinates to every logged-in
     * user, whatever the "show publicly" toggles say (they were only honoured in
     * the React page, while the data was already in the page props). Only the
     * fields listed here leave the server.
     *
     * @return array<string, mixed>
     */
    public static function summary(User $technician): array
    {
        $profile = $technician->technicianProfile;

        $data = [
            'id' => $technician->id,
            'name' => $technician->name,
            'avatar_url' => $technician->avatar_url,
            'role' => 'technician',
            'technician_profile' => $profile ? [
                'city' => $profile->city,
                'availability_status' => $profile->availability_status,
                'rating_avg' => $profile->rating_avg,
                'rating_count' => $profile->rating_count,
                'categories' => $profile->categories
                    ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])
                    ->values()
                    ->all(),
            ] : null,
        ];

        // Added by the geo search; null for technicians who have no coordinates,
        // in which case the key is left out so the page shows no distance.
        $distance = $technician->getAttributes()['distance'] ?? null;

        if ($distance !== null) {
            $data['distance'] = round((float) $distance, 2);
        }

        return $data;
    }

    /**
     * The public profile page: the card plus bio, offers, reviews and any contact
     * details and links the technician has chosen to make public.
     *
     * @return array<string, mixed>
     */
    private function detail(User $technician): array
    {
        $profile = $technician->technicianProfile;
        $data = self::summary($technician);

        if ($profile) {
            $data['technician_profile'] += [
                'bio' => $profile->bio,
                'show_phone_publicly' => (bool) $profile->show_phone_publicly,
                'show_email_publicly' => (bool) $profile->show_email_publicly,
                'phone' => $profile->show_phone_publicly ? $profile->phone : null,
            ];
        }

        $data['email'] = $profile?->show_email_publicly ? $technician->email : null;
        $data['links'] = ProfileLinks::list($technician->links);

        // The date is what lets the page list the offers among the requests.
        $data['offers'] = $technician->offers
            ->map(fn ($offer) => $offer->toCard() + ['created_at' => $offer->created_at?->toIso8601String()])
            ->values()
            ->all();

        $data['reviews_received'] = $technician->reviewsReceived
            ->map(fn ($review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'customer' => [
                    'id' => $review->customer->id,
                    'name' => $review->customer->name,
                    'avatar_url' => $review->customer->avatar_url,
                    'role' => $review->customer->role,
                ],
            ])
            ->values()
            ->all();

        return $data;
    }
}
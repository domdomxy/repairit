<?php

namespace App\Http\Controllers;

use App\Models\Offer;
use App\Models\Report;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One offer on its own page: the link people copy and share.
 *
 * Browsing every technician's offers happens in the feed (FeedController),
 * and a technician's own list (with the forms to add and edit) is a different
 * page: see TechnicianOfferController.
 */
class OfferController extends Controller
{
    /** One offer on its own page, for sharing by link. */
    public function show(Request $request, Offer $offer): Response
    {
        $offer->load(['media', 'categories', 'technician.technicianProfile']);

        $technician = $offer->technician;

        abort_unless(
            $technician->role === 'technician' && ! $technician->isHidden() && $technician->technicianProfile,
            404,
        );
        abort_if($technician->hasBlocked($request->user()), 404);

        return Inertia::render('Offers/Show', [
            'offer' => self::card($offer),
            'reportReasons' => Report::REASONS,
        ]);
    }

    /**
     * An offer plus the public card of the technician behind it.
     *
     * Technicians are never sent to the browser as raw models: that would ship
     * their email, phone, street address and exact coordinates to every
     * signed-in user, whatever their "show publicly" toggles say. Only the
     * fields listed here leave the server.
     *
     * Public so the feed can list offers with the same card.
     *
     * @return array<string, mixed>
     */
    public static function card(Offer $offer): array
    {
        $technician = $offer->technician;
        $profile = $technician->technicianProfile;

        return $offer->toCard() + [
            'created_at' => $offer->created_at?->toIso8601String(),
            'technician' => [
                'id' => $technician->id,
                'name' => $technician->name,
                'avatar_url' => $technician->avatar_url,
                'city' => $profile->city,
                'availability_status' => $profile->availability_status,
                'rating_avg' => $profile->rating_avg,
                'rating_count' => $profile->rating_count,
            ],
        ];
    }
}

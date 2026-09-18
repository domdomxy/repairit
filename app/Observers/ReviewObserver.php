<?php

namespace App\Observers;

use App\Models\Review;
use App\Models\TechnicianProfile;

/**
 * Keeps technician_profiles.rating_avg / rating_count in step with the reviews
 * table, so search results and profiles never have to aggregate on the fly.
 */
class ReviewObserver
{
    public function saved(Review $review): void
    {
        $this->refresh($review);
    }

    public function deleted(Review $review): void
    {
        $this->refresh($review);
    }

    private function refresh(Review $review): void
    {
        TechnicianProfile::where('user_id', $review->technician_id)
            ->first()
            ?->refreshRatings();
    }
}

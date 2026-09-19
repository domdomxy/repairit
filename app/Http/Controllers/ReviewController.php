<?php

namespace App\Http\Controllers;

use App\Models\Review;
use App\Models\User;
use App\Notifications\NewReview;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    // Create the customer's review of a technician, or update it if they already left one.
    public function store(Request $request, User $technician): RedirectResponse
    {
        abort_unless($technician->role === 'technician', 404);

        $customer = $request->user();
        $conversation = Review::conversationFor($customer, $technician);

        abort_if(
            $conversation === null,
            403,
            'You can review a technician once you have exchanged messages with them.'
        );

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $review = Review::updateOrCreate(
            ['customer_id' => $customer->id, 'technician_id' => $technician->id],
            [
                'conversation_id' => $conversation->id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? null,
            ]
        );

        // Editing a review shouldn't ping the technician again.
        if ($review->wasRecentlyCreated) {
            $technician->notify(new NewReview($review));
        }

        return back();
    }

    public function destroy(Request $request, User $technician): RedirectResponse
    {
        abort_unless($technician->role === 'technician', 404);

        // Delete through the model (not a query-builder delete) so the
        // observer fires and the technician's cached rating is recalculated.
        Review::where('customer_id', $request->user()->id)
            ->where('technician_id', $technician->id)
            ->get()
            ->each->delete();

        return back();
    }
}

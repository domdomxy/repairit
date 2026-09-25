<?php

namespace App\Http\Controllers;

use App\Models\CustomerReview;
use App\Models\User;
use App\Notifications\NewCustomerReview;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Technicians rating the customers they have worked with. */
class CustomerReviewController extends Controller
{
    // Create the technician's rating of a customer, or update it if they already left one.
    public function store(Request $request, User $customer): RedirectResponse
    {
        abort_unless($customer->role === 'customer' && ! $customer->isHidden(), 404);

        $technician = $request->user();

        abort_unless($technician->role === 'technician', 403, 'Only technicians can rate customers.');

        abort_if($technician->isBlockedWith($customer), 403, 'You can no longer rate this person.');

        $conversation = CustomerReview::conversationFor($technician, $customer);

        abort_if(
            $conversation === null,
            403,
            'You can rate a customer once you have exchanged messages with them.'
        );

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $review = CustomerReview::updateOrCreate(
            ['technician_id' => $technician->id, 'customer_id' => $customer->id],
            [
                'conversation_id' => $conversation->id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? null,
            ]
        );

        // Editing a rating shouldn't ping the customer again.
        if ($review->wasRecentlyCreated) {
            $customer->notifyFrom($technician, new NewCustomerReview($review));
        }

        return back();
    }

    public function destroy(Request $request, User $customer): RedirectResponse
    {
        abort_unless($customer->role === 'customer', 404);

        CustomerReview::where('technician_id', $request->user()->id)
            ->where('customer_id', $customer->id)
            ->delete();

        return back();
    }
}

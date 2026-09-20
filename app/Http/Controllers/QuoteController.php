<?php

namespace App\Http\Controllers;

use App\Models\Quote;
use App\Models\ServiceRequest;
use App\Notifications\NewQuote;
use App\Notifications\QuoteAccepted;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Technicians answering repair requests with a quote, and the customer choosing one. */
class QuoteController extends Controller
{
    // Send a quote, or change the one already sent (one per technician and request).
    public function store(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $technician = $request->user();

        abort_unless(
            $technician->role === 'technician' && $technician->technicianProfile !== null,
            403,
            'Only technicians can send quotes.'
        );
        abort_if($serviceRequest->customer_id === $technician->id, 403, 'You cannot send a quote for your own request.');

        $serviceRequest->load('customer');

        abort_if($serviceRequest->customer->isSuspended(), 404);
        abort_unless($serviceRequest->isOpen(), 403, 'This request is closed.');

        $validated = $request->validate([
            'price' => ['required', 'string', 'max:'.Quote::PRICE_MAX],
            'estimated_time' => ['nullable', 'string', 'max:'.Quote::TIME_MAX],
            'message' => ['nullable', 'string', 'max:'.Quote::MESSAGE_MAX],
        ]);

        $quote = $serviceRequest->quotes()->updateOrCreate(
            ['technician_id' => $technician->id],
            [
                'price' => $validated['price'],
                'estimated_time' => $validated['estimated_time'] ?? null,
                'message' => $validated['message'] ?? null,
            ]
        );

        // Changing a quote shouldn't ping the customer again.
        if ($quote->wasRecentlyCreated) {
            $serviceRequest->customer->notify(new NewQuote($quote));
        }

        return back()->with('success', $quote->wasRecentlyCreated ? 'Your quote was sent.' : 'Your quote was updated.');
    }

    // Take a quote back, unless the customer already chose it.
    public function destroy(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $quote = $serviceRequest->quotes()->where('technician_id', $request->user()->id)->firstOrFail();

        abort_if($quote->isAccepted(), 403, 'The customer already chose this quote.');

        $quote->delete();

        return back()->with('success', 'Your quote was withdrawn.');
    }

    // The customer chooses a quote: the request closes to new quotes and the technician is told.
    public function accept(Request $request, Quote $quote): RedirectResponse
    {
        $quote->load(['serviceRequest.customer', 'technician']);

        $serviceRequest = $quote->serviceRequest;

        abort_unless($serviceRequest->customer_id === $request->user()->id, 403);
        abort_unless($serviceRequest->isOpen(), 403, 'This request is closed.');
        abort_if($quote->technician->isSuspended(), 404);

        DB::transaction(function () use ($quote, $serviceRequest) {
            $serviceRequest->quotes()->whereKeyNot($quote->id)->update(['accepted_at' => null]);
            $quote->forceFill(['accepted_at' => now()])->save();
            $serviceRequest->update(['status' => ServiceRequest::STATUS_CLOSED]);
        });

        $quote->technician->notify(new QuoteAccepted($quote));

        return back()->with('success', "You chose {$quote->technician->name}. The request is now closed to new quotes.");
    }
}

<?php

namespace App\Http\Controllers;

use App\Events\InboxUpdated;
use App\Events\MessageUpdated;
use App\Http\Controllers\Concerns\DeliversMessages;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Quote;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Notifications\NewQuote;
use App\Notifications\QuoteAccepted;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Technicians answering repair requests with a quote, and the customer choosing one.
 *
 * A quote is also sent to the customer in their chat with the technician, as a
 * card that follows the quote: changing or deleting the quote changes the card.
 */
class QuoteController extends Controller
{
    use DeliversMessages;

    private const PER_PAGE = 12;

    /** The filter tabs of "My quotes": what became of the quotes. "all" is anything else. */
    private const STATUSES = ['pending', 'chosen', 'closed'];

    /**
     * "My quotes": every quote the technician sent, newest first, with what
     * became of it: still waiting (the request is open), chosen by the customer,
     * or closed without them (the request closed, or another quote was chosen).
     * Quotes on a suspended customer's requests are left out, as their requests are.
     */
    public function index(Request $request): Response
    {
        $technician = $request->user();

        $status = in_array($request->input('status'), self::STATUSES, true) ? $request->input('status') : 'all';

        $base = fn () => Quote::query()
            ->where('quotes.technician_id', $technician->id)
            ->whereHas('serviceRequest', fn ($query) => $query->fromActiveCustomers());

        $counts = [
            'all' => $base()->count(),
            'pending' => $this->withStatus($base(), 'pending')->count(),
            'chosen' => $this->withStatus($base(), 'chosen')->count(),
            'closed' => $this->withStatus($base(), 'closed')->count(),
        ];

        $quotes = $this->withStatus($base(), $status)
            ->with('serviceRequest.customer:id,name,avatar_path,role')
            ->latest('quotes.created_at')
            ->latest('quotes.id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        // Where the technician already talks with each customer, to open the chat from the list.
        $conversations = Conversation::where('technician_id', $technician->id)
            ->whereIn('customer_id', $quotes->getCollection()->map(fn (Quote $quote) => $quote->serviceRequest->customer_id)->unique())
            ->pluck('id', 'customer_id');

        $quotes->through(function (Quote $quote) use ($conversations) {
            $serviceRequest = $quote->serviceRequest;

            return [
                'id' => $quote->id,
                'price' => $quote->price,
                'estimated_time' => $quote->estimated_time,
                'message' => $quote->message,
                'status' => $quote->isAccepted() ? 'chosen' : ($serviceRequest->isOpen() ? 'pending' : 'closed'),
                'created_at' => $quote->created_at?->toIso8601String(),
                'conversation_id' => $conversations->get($serviceRequest->customer_id),
                'request' => [
                    'id' => $serviceRequest->id,
                    'excerpt' => $serviceRequest->excerpt(160),
                    'city' => $serviceRequest->city,
                    'budget' => $serviceRequest->budget,
                    'status' => $serviceRequest->status,
                    'customer' => [
                        'id' => $serviceRequest->customer->id,
                        'name' => $serviceRequest->customer->name,
                        'avatar_url' => $serviceRequest->customer->avatar_url,
                        'role' => $serviceRequest->customer->role,
                    ],
                ],
            ];
        });

        return Inertia::render('Quotes/Index', [
            'quotes' => $quotes,
            'counts' => $counts,
            'status' => $status,
            'quoteLimits' => Quote::limits(),
        ]);
    }

    /** Narrows a list of quotes down to one of the statuses above ("all" leaves it as it is). */
    private function withStatus(Builder $query, string $status): Builder
    {
        return match ($status) {
            'chosen' => $query->whereNotNull('quotes.accepted_at'),
            'pending' => $query->whereNull('quotes.accepted_at')
                ->whereHas('serviceRequest', fn ($request) => $request->open()),
            'closed' => $query->whereNull('quotes.accepted_at')
                ->whereHas('serviceRequest', fn ($request) => $request->where('service_requests.status', ServiceRequest::STATUS_CLOSED)),
            default => $query,
        };
    }

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

        // What it said before, kept for the admins if the quote is changed.
        $before = $serviceRequest->quotes()->where('technician_id', $technician->id)->first()?->summary();

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

        $this->syncChatCard($quote, $serviceRequest, $technician, $before);

        return back()->with('success', $quote->wasRecentlyCreated ? 'Your quote was sent.' : 'Your quote was updated.');
    }

    /**
     * Put the quote in the chat with the customer (starting the conversation if
     * there is none), or, when it is already there, bring its card up to date
     * for both of them. The customer is not sent a second notification: the
     * quote already has its own.
     */
    private function syncChatCard(Quote $quote, ServiceRequest $serviceRequest, User $technician, ?string $before): void
    {
        $conversation = Conversation::firstOrCreate([
            'customer_id' => $serviceRequest->customer_id,
            'technician_id' => $technician->id,
        ]);

        // A card the technician deleted for everyone is not brought back: the quote gets a new one.
        $message = $conversation->messages()
            ->where('quote_id', $quote->id)
            ->whereNull('deleted_for_everyone_at')
            ->latest('id')
            ->first();

        if ($message === null) {
            $message = $conversation->messages()->create([
                'sender_id' => $technician->id,
                'quote_id' => $quote->id,
                'quote_price' => $quote->price,
                'service_request_id' => $serviceRequest->id,
                'request_excerpt' => $serviceRequest->excerpt(120),
            ]);

            $this->deliver($conversation, $technician, [$message], false, notify: false);

            return;
        }

        // Sent again without changing anything.
        if (! $quote->wasChanged()) {
            return;
        }

        DB::transaction(function () use ($message, $quote, $before) {
            // Like an edited message: what the quote said is kept, so a reported chat can still be read as it was.
            if ($before !== null) {
                $message->edits()->create(['body' => $before]);
            }

            $message->forceFill(['quote_price' => $quote->price, 'edited_at' => now()])->save();
        });

        broadcast(new MessageUpdated($message))->toOthers();
        broadcast(new InboxUpdated($serviceRequest->customer_id));
    }

    // Take a quote back, unless the customer already chose it.
    public function destroy(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $quote = $serviceRequest->quotes()->where('technician_id', $request->user()->id)->firstOrFail();

        abort_if($quote->isAccepted(), 403, 'The customer already chose this quote.');

        // Its cards in the chat stay, saying the quote is gone. What it said is
        // kept for the admins, as with a deleted message.
        $messages = Message::where('quote_id', $quote->id)->get();

        DB::transaction(function () use ($quote, $messages) {
            foreach ($messages as $message) {
                $message->edits()->create(['body' => $quote->summary()]);
            }

            $quote->delete();
        });

        foreach ($messages as $message) {
            broadcast(new MessageUpdated($message->refresh()))->toOthers();
        }

        if ($messages->isNotEmpty()) {
            broadcast(new InboxUpdated($serviceRequest->customer_id));
        }

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

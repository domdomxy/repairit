<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use App\Models\User;
use App\Notifications\NewSupportTicket;
use App\Notifications\SupportReply;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** The support area as the person who asked for help sees it. */
class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        $tickets = $request->user()
            ->supportTickets()
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate(10)
            ->through(fn (SupportTicket $ticket) => [
                'id' => $ticket->id,
                'tracking_id' => $ticket->tracking_id,
                'subject' => $ticket->subject,
                'category_label' => $ticket->categoryLabel(),
                'status' => $ticket->status,
                'last_activity_at' => $ticket->last_activity_at->toIso8601String(),
            ]);

        return Inertia::render('Support/Index', ['tickets' => $tickets]);
    }

    public function create(): Response
    {
        return Inertia::render('Support/Create', ['categories' => SupportTicket::CATEGORIES]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'subject' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        // Stops one account from filling the admins' queue.
        $active = $user->supportTickets()->whereIn('status', SupportTicket::ACTIVE_STATUSES)->count();

        if ($active >= SupportTicket::MAX_ACTIVE_PER_USER) {
            throw ValidationException::withMessages([
                'subject' => 'You already have '.SupportTicket::MAX_ACTIVE_PER_USER.' open tickets. Please wait for a reply or close one first.',
            ]);
        }

        $ticket = DB::transaction(function () use ($user, $data) {
            $ticket = $user->supportTickets()->create([
                'tracking_id' => SupportTicket::generateTrackingId(),
                'category' => $data['category'],
                'subject' => trim($data['subject']),
                'status' => 'open',
                'last_activity_at' => now(),
            ]);

            $ticket->messages()->create([
                'user_id' => $user->id,
                'from_staff' => false,
                'body' => trim($data['body']),
            ]);

            return $ticket;
        });

        Notification::send($this->admins($user), new NewSupportTicket($ticket));

        return redirect()
            ->route('support.show', $ticket)
            ->with('success', "Ticket {$ticket->tracking_id} created. We'll reply here.");
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        $this->ensureOwner($request, $ticket);

        $ticket->markNotificationsReadFor($request->user());

        return Inertia::render('Support/Show', [
            'ticket' => $this->summary($ticket),
            'thread' => $ticket->threadFor($request->user()),
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->ensureOwner($request, $ticket);

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        if ($ticket->isClosed()) {
            throw ValidationException::withMessages([
                'body' => 'This ticket is closed. Please open a new ticket if you still need help.',
            ]);
        }

        $message = $ticket->messages()->create([
            'user_id' => $request->user()->id,
            'from_staff' => false,
            'body' => trim($data['body']),
        ]);

        // A reply to a resolved ticket means it was not resolved after all.
        $ticket->transitionTo($ticket->status === 'resolved' ? 'open' : $ticket->status);

        Notification::send($this->admins($request->user()), new SupportReply($ticket, $message));

        return back();
    }

    public function close(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->ensureOwner($request, $ticket);

        if (! $ticket->isClosed()) {
            $ticket->transitionTo('closed');
        }

        return back()->with('success', 'Ticket closed.');
    }

    /** Someone else's ticket is a 404, not a 403, so its existence is not confirmed. */
    private function ensureOwner(Request $request, SupportTicket $ticket): void
    {
        abort_unless($ticket->user_id === $request->user()->id, 404);
    }

    /** Everyone who can answer, except the person who wrote (an admin may open a ticket too). */
    private function admins(User $except)
    {
        return User::where('role', 'admin')
            ->whereNull('suspended_at')
            ->whereKeyNot($except->id)
            ->get();
    }

    /** @return array<string, mixed> */
    private function summary(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'tracking_id' => $ticket->tracking_id,
            'subject' => $ticket->subject,
            'category_label' => $ticket->categoryLabel(),
            'status' => $ticket->status,
            'created_at' => $ticket->created_at->toIso8601String(),
            'closed_at' => $ticket->closed_at?->toIso8601String(),
        ];
    }
}

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

/**
 * The support area for someone with no account. They can't sign in to see a
 * ticket again or get a bell notification, so a ticket's `guest_token` (in
 * the link they're given, and in every email) stands in for being logged in.
 */
class GuestSupportController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Support/GuestCreate', ['categories' => SupportTicket::CATEGORIES]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'category' => ['required', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'subject' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        // Stops one email address from flooding the admins' queue.
        $active = SupportTicket::whereNull('user_id')
            ->where('guest_email', $data['email'])
            ->whereIn('status', SupportTicket::ACTIVE_STATUSES)
            ->count();

        if ($active >= SupportTicket::MAX_ACTIVE_PER_USER) {
            throw ValidationException::withMessages([
                'subject' => 'There are already '.SupportTicket::MAX_ACTIVE_PER_USER.' open tickets for that email. Please wait for a reply or close one first.',
            ]);
        }

        $ticket = DB::transaction(function () use ($data) {
            $ticket = SupportTicket::create([
                'tracking_id' => SupportTicket::generateTrackingId(),
                'guest_token' => SupportTicket::generateGuestToken(),
                'guest_name' => trim($data['name']),
                'guest_email' => $data['email'],
                'category' => $data['category'],
                'subject' => trim($data['subject']),
                'status' => 'open',
                'last_activity_at' => now(),
            ]);

            $ticket->messages()->create([
                'user_id' => null,
                'from_staff' => false,
                'body' => trim($data['body']),
            ]);

            return $ticket;
        });

        Notification::send($this->admins(), new NewSupportTicket($ticket));

        return redirect()
            ->route('support.guest.show', ['ticket' => $ticket->id, 'token' => $ticket->guest_token])
            ->with('success', "Ticket {$ticket->tracking_id} created. Save this page's link — it's the only way back in, since there's no account to notify.");
    }

    public function track(): Response
    {
        return Inertia::render('Support/GuestTrack');
    }

    /** Turns a tracking ID + email back into the one link that actually opens the ticket. */
    public function lookup(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'tracking_id' => ['required', 'string'],
            'email' => ['required', 'email'],
        ]);

        $ticket = SupportTicket::whereNull('user_id')
            ->whereRaw('upper(tracking_id) = ?', [strtoupper(trim($data['tracking_id']))])
            ->whereRaw('lower(guest_email) = ?', [strtolower(trim($data['email']))])
            ->first();

        if (! $ticket) {
            throw ValidationException::withMessages([
                'tracking_id' => "We couldn't find a ticket with that ID and email.",
            ]);
        }

        return redirect()->route('support.guest.show', ['ticket' => $ticket->id, 'token' => $ticket->guest_token]);
    }

    public function show(Request $request, SupportTicket $ticket, string $token): Response
    {
        $this->ensureToken($ticket, $token);

        return Inertia::render('Support/GuestShow', [
            'ticket' => $this->summary($ticket),
            'thread' => $ticket->threadFor(null),
            'token' => $token,
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket, string $token): RedirectResponse
    {
        $this->ensureToken($ticket, $token);

        $data = $request->validate(['body' => ['required', 'string', 'max:5000']]);

        if ($ticket->isClosed()) {
            throw ValidationException::withMessages([
                'body' => 'This ticket is closed. Please open a new ticket if you still need help.',
            ]);
        }

        $message = $ticket->messages()->create([
            'user_id' => null,
            'from_staff' => false,
            'body' => trim($data['body']),
        ]);

        // A reply to a resolved ticket means it was not resolved after all.
        $ticket->transitionTo($ticket->status === 'resolved' ? 'open' : $ticket->status);

        Notification::send($this->admins(), new SupportReply($ticket, $message));

        return back();
    }

    /** A wrong or missing token is a 404, same as someone else's ticket for a signed-in user. */
    private function ensureToken(SupportTicket $ticket, string $token): void
    {
        abort_unless($ticket->isGuest() && hash_equals((string) $ticket->guest_token, $token), 404);
    }

    private function admins()
    {
        return User::where('role', 'admin')->whereNull('suspended_at')->get();
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

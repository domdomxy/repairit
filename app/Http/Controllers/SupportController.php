<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesSupportAttachments;
use App\Models\AutoResponse;
use App\Models\SupportMessageAttachment;
use App\Models\SupportMessage;
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
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

/** The support area as the person who asked for help sees it. */
class SupportController extends Controller
{
    use HandlesSupportAttachments;

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
        return Inertia::render('Support/Create', [
            'categories' => SupportTicket::CATEGORIES,
            'attachmentLimits' => SupportMessage::attachmentLimits(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'category' => ['required', Rule::in(array_keys(SupportTicket::CATEGORIES))],
            'subject' => ['required', 'string', 'max:150'],
            'body' => ['required', 'string', 'max:5000'],
            ...$this->attachmentRules(),
        ], $this->attachmentMessages());

        // Stops one account from filling the admins' queue.
        $active = $user->supportTickets()->whereIn('status', SupportTicket::ACTIVE_STATUSES)->count();

        if ($active >= SupportTicket::MAX_ACTIVE_PER_USER) {
            throw ValidationException::withMessages([
                'subject' => 'You already have '.SupportTicket::MAX_ACTIVE_PER_USER.' open tickets. Please wait for a reply or close one first.',
            ]);
        }

        // Pictures are stored before their rows are written and removed again
        // if anything fails, so a failed send never leaves files behind.
        $stored = [];

        try {
            $ticket = DB::transaction(function () use ($request, $user, $data, &$stored) {
                $ticket = $user->supportTickets()->create([
                    'tracking_id' => SupportTicket::generateTrackingId(),
                    'category' => $data['category'],
                    'subject' => trim($data['subject']),
                    'status' => 'open',
                    'last_activity_at' => now(),
                ]);

                $message = $ticket->messages()->create([
                    'user_id' => $user->id,
                    'from_staff' => false,
                    'body' => trim($data['body']),
                ]);

                $this->storeAttachments($message, $request->file('attachments', []), $stored);

                $this->sendAutoResponse($ticket, $data['category']);

                return $ticket;
            });
        } catch (Throwable $e) {
            $this->deleteStored($stored);

            throw $e;
        }

        Notification::send($this->admins($user), new NewSupportTicket($ticket));

        return redirect()
            ->route('support.show', $ticket)
            ->with('success', "Ticket {$ticket->tracking_id} created. We'll reply here.");
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        $this->ensureOwner($request, $ticket);

        $ticket->markNotificationsReadFor($request->user());

        // Marked read on every load, including the reload that brings in a
        // message live, but only the first load sends this on to the page (a
        // reload of just the thread leaves it alone), so the "New messages"
        // line stays where this visit found it.
        $firstUnreadId = $ticket->markReadBy(staff: false);

        return Inertia::render('Support/Show', [
            'ticket' => $this->summary($ticket),
            'thread' => $ticket->threadFor($request->user()),
            // The oldest message from support this person had not read yet, or null.
            'first_unread_id' => $firstUnreadId,
            'attachmentLimits' => SupportMessage::attachmentLimits(),
        ]);
    }

    /** One picture of the person's own ticket. Someone else's is a 404, like the ticket itself. */
    public function attachment(Request $request, SupportTicket $ticket, SupportMessageAttachment $attachment): StreamedResponse
    {
        $this->ensureOwner($request, $ticket);

        return $this->streamAttachment($ticket, $attachment);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $this->ensureOwner($request, $ticket);

        // Text is optional when pictures are attached, and the other way round.
        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:5000', 'required_without:attachments'],
            ...$this->attachmentRules(),
        ], $this->attachmentMessages());

        if ($ticket->isClosed()) {
            throw ValidationException::withMessages([
                'body' => 'This ticket is closed. Please open a new ticket if you still need help.',
            ]);
        }

        $stored = [];

        try {
            $message = DB::transaction(function () use ($request, $ticket, $data, &$stored) {
                $message = $ticket->messages()->create([
                    'user_id' => $request->user()->id,
                    'from_staff' => false,
                    'body' => trim((string) ($data['body'] ?? '')),
                ]);

                $this->storeAttachments($message, $request->file('attachments', []), $stored);

                return $message;
            });
        } catch (Throwable $e) {
            $this->deleteStored($stored);

            throw $e;
        }

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

    /**
     * Post the category's canned reply as soon as the ticket exists, if an
     * admin hasn't turned it off. Not a real answer, so it doesn't touch the
     * ticket's status — only its last-activity time, so it still surfaces.
     */
    private function sendAutoResponse(SupportTicket $ticket, string $category): void
    {
        $body = AutoResponse::textFor(AutoResponse::TYPE_SUPPORT, $category);

        if ($body === null) {
            return;
        }

        $ticket->messages()->create([
            'user_id' => null,
            'from_staff' => true,
            'is_automated' => true,
            'body' => $body,
            // They are looking at the ticket as it is sent, so this is not "new".
            'read_at' => now(),
        ]);

        $ticket->update(['last_activity_at' => now()]);
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

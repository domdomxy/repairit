<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\SupportTicket;
use App\Notifications\SupportReply;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/** The support queue as an admin works it. */
class SupportController extends Controller
{
    public function index(Request $request): Response
    {
        $term = trim((string) $request->input('q'));
        $status = $request->input('status');
        $category = $request->input('category');

        $tickets = SupportTicket::query()
            ->with('user:id,name,email,avatar_path')
            ->when($term !== '', fn ($query) => $query->where(
                fn ($query) => $query
                    ->where('tracking_id', 'like', "%{$term}%")
                    ->orWhere('subject', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($q) => $q
                        ->where('name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%"))
            ))
            ->when(in_array($status, SupportTicket::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->when(array_key_exists((string) $category, SupportTicket::CATEGORIES), fn ($query) => $query->where('category', $category))
            // Work that needs a person first, then by how recently anything happened.
            ->orderByRaw("case status when 'open' then 0 when 'in_progress' then 1 when 'resolved' then 2 else 3 end")
            ->orderByDesc('last_activity_at')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (SupportTicket $ticket) => [
                'id' => $ticket->id,
                'tracking_id' => $ticket->tracking_id,
                'subject' => $ticket->subject,
                'category_label' => $ticket->categoryLabel(),
                'status' => $ticket->status,
                'last_activity_at' => $ticket->last_activity_at->toIso8601String(),
                'user' => [
                    'name' => $ticket->user->name,
                    'email' => $ticket->user->email,
                    'avatar_url' => $ticket->user->avatar_url,
                ],
            ]);

        return Inertia::render('Admin/Support/Index', [
            'tickets' => $tickets,
            'filters' => ['q' => $term, 'status' => $status, 'category' => $category],
            'categories' => SupportTicket::CATEGORIES,
            'counts' => SupportTicket::query()
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
        ]);
    }

    public function show(Request $request, SupportTicket $ticket): Response
    {
        $ticket->load('user:id,name,email,role,suspended_at,avatar_path');
        $ticket->markNotificationsReadFor($request->user());

        return Inertia::render('Admin/Support/Show', [
            'ticket' => [
                'id' => $ticket->id,
                'tracking_id' => $ticket->tracking_id,
                'subject' => $ticket->subject,
                'category_label' => $ticket->categoryLabel(),
                'status' => $ticket->status,
                'created_at' => $ticket->created_at->toIso8601String(),
                'closed_at' => $ticket->closed_at?->toIso8601String(),
                'user' => [
                    'name' => $ticket->user->name,
                    'email' => $ticket->user->email,
                    'avatar_url' => $ticket->user->avatar_url,
                    'role' => $ticket->user->role,
                    'suspended' => $ticket->user->isSuspended(),
                ],
            ],
            'thread' => $ticket->threadFor($request->user()),
        ]);
    }

    public function reply(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            // Optionally settle the ticket in the same step as answering it.
            'status' => ['nullable', Rule::in(SupportTicket::STATUSES)],
        ]);

        if ($ticket->isClosed()) {
            throw ValidationException::withMessages([
                'body' => 'This ticket is closed. Reopen it before replying.',
            ]);
        }

        // Answering an untouched ticket means someone is on it.
        $status = $data['status'] ?? ($ticket->status === 'open' ? 'in_progress' : $ticket->status);
        $statusChanged = $status !== $ticket->status;

        $message = DB::transaction(function () use ($request, $ticket, $data, $status) {
            $message = $ticket->messages()->create([
                'user_id' => $request->user()->id,
                'from_staff' => true,
                'body' => trim($data['body']),
            ]);

            $ticket->transitionTo($status);

            AdminLog::record(
                $request->user(),
                'support.replied',
                "Replied to ticket {$ticket->tracking_id} from {$ticket->user->name}".($status !== 'open' ? " (now {$status})" : ''),
                $ticket,
            );

            return $message;
        });

        $this->notifyOwner($ticket, new SupportReply($ticket, $message, $statusChanged ? $status : null));

        return back()->with('success', 'Reply sent.');
    }

    public function status(Request $request, SupportTicket $ticket): RedirectResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(SupportTicket::STATUSES)]]);

        if ($data['status'] === $ticket->status) {
            return back();
        }

        $from = $ticket->status;

        DB::transaction(function () use ($request, $ticket, $data, $from) {
            $ticket->transitionTo($data['status']);

            AdminLog::record(
                $request->user(),
                'support.status_changed',
                "Ticket {$ticket->tracking_id}: {$from} to {$data['status']}",
                $ticket,
            );
        });

        $this->notifyOwner($ticket, new SupportTicketStatusChanged($ticket, $data['status']));

        return back()->with('success', 'Status updated.');
    }

    /** A suspended owner can't sign in to read it, so there is nothing to tell them. */
    private function notifyOwner(SupportTicket $ticket, $notification): void
    {
        $owner = $ticket->user;

        if (! $owner->isSuspended()) {
            $owner->notify($notification);
        }
    }
}

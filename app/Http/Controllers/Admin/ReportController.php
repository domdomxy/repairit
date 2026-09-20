<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Message;
use App\Models\Report;
use App\Notifications\NewReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Reported messages and conversations, as an admin works through them.
 *
 * A report is the only way an admin gets to read a private conversation. The
 * page shows all of it, including messages that were deleted (for one person or
 * for both) and what edited messages said before they were changed.
 */
class ReportController extends Controller
{
    public function index(Request $request): Response
    {
        $term = trim((string) $request->input('q'));
        $status = $request->input('status');
        $reason = $request->input('reason');

        $reports = Report::query()
            ->with([
                'reporter:id,name,email,role,suspended_at,avatar_path',
                'reportedUser:id,name,email,role,suspended_at,avatar_path',
            ])
            ->when($term !== '', fn ($query) => $query->where(
                fn ($query) => $query
                    ->whereHas('reporter', fn ($q) => $q->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
                    ->orWhereHas('reportedUser', fn ($q) => $q->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"))
            ))
            ->when(in_array($status, Report::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->when(array_key_exists((string) $reason, Report::REASONS), fn ($query) => $query->where('reason', $reason))
            // Work that needs a person first, then the newest.
            ->orderByRaw("case status when 'open' then 0 else 1 end")
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (Report $report) => [
                'id' => $report->id,
                'status' => $report->status,
                'reason_label' => $report->reasonLabel(),
                'type' => $report->isMessageReport() ? 'message' : 'conversation',
                'created_at' => $report->created_at->toIso8601String(),
                'reporter' => $this->person($report->reporter),
                'reported' => $this->person($report->reportedUser),
            ]);

        return Inertia::render('Admin/Reports/Index', [
            'reports' => $reports,
            'filters' => ['q' => $term, 'status' => $status, 'reason' => $reason],
            'reasons' => Report::REASONS,
            'counts' => Report::query()
                ->selectRaw('status, count(*) as total')
                ->groupBy('status')
                ->pluck('total', 'status'),
        ]);
    }

    public function show(Request $request, Report $report): Response
    {
        $admin = $request->user();

        $report->load([
            'reporter:id,name,email,role,suspended_at,avatar_path',
            'reportedUser:id,name,email,role,suspended_at,avatar_path',
            'reviewer:id,name',
            'conversation',
        ]);
        $conversation = $report->conversation;

        // Reading a private conversation is recorded, once per admin and report,
        // so the activity log shows who looked at what.
        $alreadyLogged = AdminLog::where('admin_id', $admin->id)
            ->where('action', 'report.viewed')
            ->where('target_type', 'Report')
            ->where('target_id', $report->id)
            ->exists();

        if (! $alreadyLogged) {
            AdminLog::record(
                $admin,
                'report.viewed',
                "Opened report #{$report->id} ({$report->reporter->name} reporting {$report->reportedUser->name}) and read the conversation",
                $report,
            );
        }

        $admin->unreadNotifications()
            ->where('type', NewReport::class)
            ->get()
            ->filter(fn ($notification) => ($notification->data['report_id'] ?? null) === $report->id)
            ->each->markAsRead();

        $messages = $conversation->messages()
            ->with(['sender:id,name', 'attachments', 'edits', 'deletions.user:id,name'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Message $message) => [
                'id' => $message->id,
                'sender_id' => $message->sender_id,
                'sender_name' => $message->sender?->name ?? 'Deleted user',
                'body' => $message->body,
                'attachments' => $message->attachments->toArray(),
                // The offer shared in this message (the title is kept even if the offer is gone).
                'offer' => $message->offer_title === null ? null : [
                    'title' => $message->offer_title,
                    'url' => $message->offer_id ? route('offers.show', $message->offer_id, absolute: false) : null,
                ],
                'created_at' => $message->created_at->toIso8601String(),
                'edited_at' => $message->edited_at?->toIso8601String(),
                'edits' => $message->edits->map(fn ($edit) => [
                    'body' => $edit->body,
                    'replaced_at' => $edit->created_at->toIso8601String(),
                ])->values()->all(),
                'deleted_for_everyone_at' => $message->deleted_for_everyone_at?->toIso8601String(),
                'deleted_for' => $message->deletions->map(fn ($deletion) => [
                    'name' => $deletion->user?->name ?? 'Deleted user',
                    'at' => $deletion->created_at->toIso8601String(),
                ])->values()->all(),
                'flagged' => $message->id === $report->message_id,
            ])
            ->values()
            ->all();

        return Inertia::render('Admin/Reports/Show', [
            'report' => [
                'id' => $report->id,
                'status' => $report->status,
                'type' => $report->isMessageReport() ? 'message' : 'conversation',
                'message_id' => $report->message_id,
                'reason' => $report->reason,
                'reason_label' => $report->reasonLabel(),
                'details' => $report->details,
                'created_at' => $report->created_at->toIso8601String(),
                'resolution_note' => $report->resolution_note,
                'reviewed_at' => $report->reviewed_at?->toIso8601String(),
                'reviewer' => $report->reviewer?->name,
                'reporter' => $this->person($report->reporter),
                'reported' => $this->person($report->reportedUser),
                'customer_id' => $conversation->customer_id,
                'technician_id' => $conversation->technician_id,
            ],
            'messages' => $messages,
            // Other reports about the same conversation, so nothing is judged in isolation.
            'related' => Report::where('conversation_id', $conversation->id)
                ->whereKeyNot($report->id)
                ->with('reporter:id,name')
                ->latest()
                ->get()
                ->map(fn (Report $other) => [
                    'id' => $other->id,
                    'status' => $other->status,
                    'reason_label' => $other->reasonLabel(),
                    'reporter' => $other->reporter->name,
                    'created_at' => $other->created_at->toIso8601String(),
                ])
                ->all(),
            'statuses' => Report::STATUSES,
        ]);
    }

    public function status(Request $request, Report $report): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(Report::STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $note = isset($data['note']) ? trim($data['note']) : null;
        $note = $note === '' ? null : $note;

        if ($data['status'] === $report->status && $note === null) {
            return back();
        }

        $from = $report->status;
        $changed = $from !== $data['status'];

        DB::transaction(function () use ($request, $report, $data, $note, $changed) {
            $reopened = $data['status'] === 'open';

            $report->forceFill([
                'status' => $data['status'],
                'resolution_note' => $note ?? $report->resolution_note,
                'reviewed_by_id' => $reopened ? null : $request->user()->id,
                'reviewed_at' => $reopened ? null : now(),
            ])->save();

            AdminLog::record(
                $request->user(),
                'report.'.($reopened ? 'reopened' : $data['status']),
                "Report #{$report->id} against {$report->reportedUser->name}: ".($changed ? "marked {$data['status']}" : 'note added'),
                $report,
            );
        });

        return back()->with('success', $changed ? 'Report updated.' : 'Note saved.');
    }

    /** @return array<string, mixed>|null */
    private function person($user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'avatar_url' => $user->avatar_url,
            'suspended' => $user->isSuspended(),
        ];
    }
}

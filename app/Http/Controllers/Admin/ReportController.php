<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Message;
use App\Models\Report;
use App\Notifications\NewReport;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Reported messages, conversations, offers, repair requests and reviews, as an admin works through them.
 *
 * A report is the only way an admin gets to read a private conversation. The
 * page shows all of it, including messages that were deleted (for one person or
 * for both) and what edited messages said before they were changed. A report
 * about an offer or a request shows that post instead, and one about a review
 * shows the review as it was reported: none of them has a conversation.
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
                'type' => $report->type(),
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
            'offer.categories',
            'offer.media',
            'serviceRequest.customer:id,name,avatar_path,role',
            'serviceRequest.categories',
            'serviceRequest.media',
            'review',
            'customerReview',
            'reviewSubject:id,name,email,role,suspended_at,avatar_path',
        ]);
        // An offer or request report has no conversation, and the post may have been deleted since.
        $conversation = $report->conversation;
        $offer = $report->offer;
        $serviceRequest = $report->serviceRequest?->loadCount('quotes');

        // Reading a private conversation is recorded, once per admin and report,
        // so the activity log shows who looked at what.
        $alreadyLogged = AdminLog::where('admin_id', $admin->id)
            ->where('action', 'report.viewed')
            ->where('target_type', 'Report')
            ->where('target_id', $report->id)
            ->exists();

        if (! $alreadyLogged) {
            $looked = match ($report->type()) {
                'review' => 'looked at the review',
                'offer' => 'looked at the offer',
                'request' => 'looked at the request',
                default => 'read the conversation',
            };

            AdminLog::record(
                $admin,
                'report.viewed',
                "Opened report #{$report->id} ({$report->reporter->name} reporting {$report->reportedUser->name}) and {$looked}",
                $report,
            );
        }

        $admin->unreadNotifications()
            ->where('type', NewReport::class)
            ->get()
            ->filter(fn ($notification) => ($notification->data['report_id'] ?? null) === $report->id)
            ->each->markAsRead();

        $messages = $conversation?->messages()
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
            ->all() ?? [];

        return Inertia::render('Admin/Reports/Show', [
            'report' => [
                'id' => $report->id,
                'status' => $report->status,
                'type' => $report->type(),
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
                'customer_id' => $conversation?->customer_id,
                'technician_id' => $conversation?->technician_id,
            ],
            'messages' => $messages,
            // The reported offer as it is now; without a card once the offer is deleted (the title is kept).
            'offer' => $report->isOfferReport() ? [
                'title' => $offer?->title ?? $report->offer_title,
                'card' => $offer?->toCard(),
            ] : null,
            // The reported request as it is now; without a card once the request is deleted (the title is kept).
            'serviceRequest' => $report->isRequestReport() ? [
                'excerpt' => $serviceRequest?->excerpt(120) ?? $report->request_excerpt,
                'card' => $serviceRequest?->toCard(),
            ] : null,
            // The reported review: what it said when it was reported, and whether it still stands.
            'review' => $report->isReviewReport() ? $this->reviewPayload($report) : null,
            // Other reports about the same conversation, offer, request or review, so nothing is judged in isolation.
            'related' => $this->relatedTo($report)
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

    /**
     * Remove the review a report is about. Reviews are kept until an admin
     * decides otherwise, so this is a separate step from closing the report.
     */
    public function destroyReview(Request $request, Report $report): RedirectResponse
    {
        $review = $report->review ?? $report->customerReview;

        abort_if($review === null, 404, 'That review is already gone.');

        $writer = $report->reportedUser?->name ?? 'a deleted user';
        $about = $report->reviewSubject?->name ?? 'a deleted user';

        AdminLog::record(
            $request->user(),
            'review.deleted',
            "Removed {$review->rating}-star review by {$writer} for {$about} (report #{$report->id})",
            $review,
        );

        // Model delete (not a query delete) so the observer refreshes a
        // technician's cached rating.
        $review->delete();

        return back()->with('success', 'Review removed.');
    }

    /** The other reports about the same conversation, offer, request or review. */
    private function relatedTo(Report $report): Builder
    {
        return Report::query()
            ->whereKeyNot($report->id)
            ->when(
                $report->isReviewReport(),
                // A review that has been deleted no longer links its reports together.
                fn ($query) => $query->where(fn ($query) => $query
                    ->where('review_id', $report->review_id ?? 0)
                    ->orWhere('customer_review_id', $report->customer_review_id ?? 0)),
                fn ($query) => $query->when(
                    $report->conversation_id !== null,
                    fn ($query) => $query->where('conversation_id', $report->conversation_id),
                    // An offer or request that has been deleted no longer links its reports together.
                    fn ($query) => $query->when(
                        $report->isRequestReport(),
                        fn ($query) => $query->where('service_request_id', $report->service_request_id ?? 0),
                        fn ($query) => $query->where('offer_id', $report->offer_id ?? 0),
                    ),
                ),
            );
    }

    /**
     * A reported review as the admin sees it: the copy taken when it was
     * reported, and whether the live one is still the same, was changed
     * since, or is gone.
     *
     * @return array<string, mixed>
     */
    private function reviewPayload(Report $report): array
    {
        $live = $report->review ?? $report->customerReview;

        return [
            'kind' => $report->review_kind,
            'rating' => $report->review_rating,
            'comment' => $report->review_comment,
            'subject' => $this->person($report->reviewSubject),
            // Whether the review can still be removed from here.
            'exists' => $live !== null,
            'changed' => $live !== null
                && ($live->rating !== $report->review_rating || $live->comment !== $report->review_comment),
            'current_rating' => $live?->rating,
            'current_comment' => $live?->comment,
        ];
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

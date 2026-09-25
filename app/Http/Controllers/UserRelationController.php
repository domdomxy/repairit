<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\User;
use App\Models\UserRelation;
use App\Models\UserWarning;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Blocking, muting, favoriting and restricting other people, and undoing each.
 * The other person is never told. See UserRelation for what each one does.
 */
class UserRelationController extends Controller
{
    /** What the flash message says once each has been applied / undone. */
    private const DONE = [
        UserRelation::BLOCK => ['blocked', 'unblocked'],
        UserRelation::MUTE => ['muted', 'unmuted'],
        UserRelation::FAVORITE => ['added to your favorites', 'removed from your favorites'],
        UserRelation::RESTRICT => ['restricted', 'unrestricted'],
    ];

    /** Everyone the signed-in person has blocked, muted, favorited or restricted, one list per kind. */
    public function index(Request $request): Response
    {
        $lists = [];

        foreach (UserRelation::TYPES as $type) {
            $lists[$type] = UserRelation::where('user_id', $request->user()->id)
                ->where('type', $type)
                ->with('target:id,name,avatar_path,role')
                ->latest('id')
                ->get()
                ->map(fn (UserRelation $relation) => [
                    'id' => $relation->target->id,
                    'name' => $relation->target->name,
                    'avatar_url' => $relation->target->avatar_url,
                    'role' => $relation->target->role,
                ])
                ->values()
                ->all();
        }

        return Inertia::render('Settings/Index', [
            'lists' => $lists,
            'health' => $this->health($request->user()),
        ]);
    }

    /** The signed-in person's own account health status, for the Settings page. */
    private function health(User $user): array
    {
        return [
            'status' => $user->healthStatus(),
            // 0-3, only meaningful while status is 'warned' — see User::healthLevel().
            'level' => $user->healthLevel(),
            'suspended_at' => $user->suspended_at?->toIso8601String(),
            'warnings' => $user->warnings()
                ->with([
                    'report.message',
                    'report.offer',
                    'report.serviceRequest',
                    'report.reviewSubject:id,name',
                    'report.conversation',
                ])
                ->get()
                ->map(fn (UserWarning $warning) => [
                    'id' => $warning->id,
                    'reason' => $warning->reason,
                    'issued_at' => $warning->created_at->toIso8601String(),
                    'expires_at' => $warning->expires_at->toIso8601String(),
                    'active' => $warning->isActive(),
                    'report' => $warning->report ? $this->reportedItem($warning->report, $user) : null,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * The reported item behind a warning, as shown to the account holder
     * themselves: what kind of thing it was and what it said, so they can see
     * exactly what the warning was about — not who reported it or the admin's
     * notes, which stay admin-only.
     *
     * @return array<string, mixed>
     */
    private function reportedItem(Report $report, User $user): array
    {
        $content = match ($report->type()) {
            'message' => $report->message === null
                ? 'This message has since been deleted.'
                : ($report->message->isDeletedForEveryone() ? 'This message has since been deleted.' : $report->message->body),
            'conversation' => $report->conversation
                ? 'Your conversation with '.($report->conversation->participantFor($user)?->name ?? 'a deleted user').'.'
                : 'This conversation no longer exists.',
            'offer' => $report->offer?->title ?? $report->offer_title ?? 'This offer no longer exists.',
            'request' => $report->serviceRequest?->excerpt(160) ?? $report->request_excerpt ?? 'This request no longer exists.',
            'review' => trim(str_repeat('★', (int) $report->review_rating).' '.$report->review_comment),
            default => 'Your account was reported as a whole.',
        };

        return [
            'type' => $report->type(),
            'reason_label' => $report->reasonLabel(),
            'content' => $content,
            'subject' => $report->isReviewReport() ? $report->reviewSubject?->name : null,
        ];
    }

    public function store(Request $request, User $user, string $relation): RedirectResponse
    {
        $me = $request->user();

        $this->authorizeTarget($me, $user);

        if ($relation === UserRelation::FAVORITE) {
            abort_if($me->hasBlocked($user), 422, 'Unblock this person before adding them to your favorites.');
        }

        UserRelation::firstOrCreate(['user_id' => $me->id, 'target_id' => $user->id, 'type' => $relation]);

        // Someone you blocked is no longer a favorite.
        if ($relation === UserRelation::BLOCK) {
            UserRelation::where('user_id', $me->id)
                ->where('target_id', $user->id)
                ->where('type', UserRelation::FAVORITE)
                ->delete();
        }

        return back()->with('success', "{$user->name} {$this->done($relation, 0)}.");
    }

    public function destroy(Request $request, User $user, string $relation): RedirectResponse
    {
        $me = $request->user();

        // Suspended or deleted-from-view accounts can always be undone; only yourself and admins are refused.
        $this->authorizeTarget($me, $user);

        UserRelation::where('user_id', $me->id)
            ->where('target_id', $user->id)
            ->where('type', $relation)
            ->delete();

        return back()->with('success', "{$user->name} {$this->done($relation, 1)}.");
    }

    private function authorizeTarget(User $me, User $target): void
    {
        abort_if($me->id === $target->id, 403, 'You cannot do this to yourself.');
        // Admins are reached through support and cannot be blocked or muted.
        abort_if($target->isAdmin(), 403, 'This account cannot be blocked, muted, restricted or favorited.');
    }

    private function done(string $relation, int $undo): string
    {
        return self::DONE[$relation][$undo];
    }
}

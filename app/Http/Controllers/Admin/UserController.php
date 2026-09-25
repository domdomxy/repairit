<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Report;
use App\Models\Review;
use App\Models\User;
use App\Models\UserWarning;
use App\Notifications\AccountRestored;
use App\Notifications\AccountSuspended;
use App\Notifications\AccountWarned;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $term = trim((string) $request->input('q'));
        $role = $request->input('role');
        $status = $request->input('status');

        $users = User::query()
            ->withCount('activeWarnings')
            ->when($term !== '', fn ($query) => $query->where(
                fn ($query) => $query
                    ->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
            ))
            ->when(in_array($role, ['customer', 'technician', 'admin'], true),
                fn ($query) => $query->where('role', $role))
            ->when($status === 'suspended', fn ($query) => $query->whereNotNull('suspended_at'))
            ->when($status === 'active', fn ($query) => $query->whereNull('suspended_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
                'role' => $user->role,
                'suspended_at' => $user->suspended_at?->toIso8601String(),
                'created_at' => $user->created_at->toIso8601String(),
                'health_status' => $user->isSuspended() ? 'suspended' : ($user->active_warnings_count > 0 ? 'warned' : 'good'),
                'active_warnings' => $user->active_warnings_count,
                // 0-3, only meaningful while health_status is 'warned' — see User::healthLevel().
                'health_level' => min($user->active_warnings_count, count(User::HEALTH_LEVEL_LABELS) - 1),
            ]);

        return Inertia::render('Admin/Users/Index', [
            'users' => $users,
            'filters' => [
                'q' => $term,
                'role' => $role,
                'status' => $status,
            ],
        ]);
    }

    public function suspend(Request $request, User $user): RedirectResponse
    {
        // Admin accounts are never managed from here, which also stops an
        // admin from locking themselves (or the last admin) out.
        abort_if($user->isAdmin(), 403, 'Admin accounts cannot be suspended.');

        if (! $user->isSuspended()) {
            $user->suspended_at = now();
            $user->save();

            AdminLog::record(
                $request->user(),
                'user.suspended',
                "Suspended {$user->name} ({$user->email}, {$user->role})",
                $user,
            );

            $user->notify(new AccountSuspended);
        }

        return back()->with('success', "{$user->name} has been suspended.");
    }

    /**
     * Issue a warning, short of suspending the account outright. Counts
     * toward the account's health status for 90 days (UserWarning::LIFESPAN_DAYS),
     * then ages out on its own. When issued from a report (report_id), the
     * warning is linked back to it so the account holder sees what was
     * reported alongside it on their account health page.
     */
    public function warn(Request $request, User $user): RedirectResponse
    {
        abort_if($user->isAdmin(), 403, 'Admin accounts cannot be warned.');

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
            'report_id' => ['nullable', 'integer', 'exists:reports,id'],
        ]);

        // Only link a report that is actually about this user — never let the
        // client point a warning at someone else's report.
        $report = isset($data['report_id'])
            ? Report::where('id', $data['report_id'])->where('reported_user_id', $user->id)->first()
            : null;

        $warning = UserWarning::create([
            'user_id' => $user->id,
            'admin_id' => $request->user()->id,
            'report_id' => $report?->id,
            'reason' => $data['reason'],
            'expires_at' => now()->addDays(UserWarning::LIFESPAN_DAYS),
        ]);

        AdminLog::record(
            $request->user(),
            'user.warned',
            "Warned {$user->name} ({$user->email}, {$user->role}): {$data['reason']}"
                .($report ? " (report #{$report->id})" : ''),
            $user,
        );

        $user->notify(new AccountWarned($warning));

        return back()->with('success', "{$user->name} has been warned.");
    }

    public function unsuspend(Request $request, User $user): RedirectResponse
    {
        abort_if($user->isAdmin(), 403);

        if ($user->isSuspended()) {
            $user->suspended_at = null;
            $user->save();

            AdminLog::record(
                $request->user(),
                'user.unsuspended',
                "Restored {$user->name} ({$user->email}, {$user->role})",
                $user,
            );

            $user->notify(new AccountRestored);
        }

        return back()->with('success', "{$user->name} has been restored.");
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        abort_if($user->isAdmin(), 403, 'Admin accounts cannot be deleted.');

        $description = "Deleted {$user->name} ({$user->email}, {$user->role})";

        DB::transaction(function () use ($request, $user, $description) {
            // Reviews are removed through the model so the observer refreshes
            // each technician's cached rating. The database cascade below
            // would delete them silently and leave stale averages behind.
            Review::where('customer_id', $user->id)->get()->each->delete();

            AdminLog::record($request->user(), 'user.deleted', $description, $user);

            $user->delete();
        });

        return back()->with('success', 'The user has been deleted.');
    }
}

<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\Review;
use App\Models\User;
use App\Notifications\AccountRestored;
use App\Notifications\AccountSuspended;
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
                'role' => $user->role,
                'suspended_at' => $user->suspended_at?->toIso8601String(),
                'created_at' => $user->created_at->toIso8601String(),
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

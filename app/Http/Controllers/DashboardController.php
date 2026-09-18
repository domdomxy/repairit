<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\Review;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = Auth::user();

        return match ($user->role) {
            'technician' => Inertia::render('Dashboard/Technician', [
                'conversationCount' => $user->technicianConversations()->count(),
            ]),
            'admin' => Inertia::render('Dashboard/Admin', $this->adminStats()),
            default => Inertia::render('Dashboard/Customer', [
                'conversationCount' => $user->customerConversations()->count(),
            ]),
        };
    }

    /**
     * Headline numbers and recent activity for the admin dashboard.
     *
     * @return array<string, mixed>
     */
    private function adminStats(): array
    {
        return [
            'stats' => [
                'users' => User::count(),
                'customers' => User::where('role', 'customer')->count(),
                'technicians' => User::where('role', 'technician')->count(),
                'suspended' => User::whereNotNull('suspended_at')->count(),
                'categories' => Category::count(),
                'conversations' => Conversation::count(),
                'reviews' => Review::count(),
            ],
            'recentUsers' => User::latest()->orderByDesc('id')->limit(5)
                ->get(['id', 'name', 'email', 'role', 'created_at']),
            'recentLogs' => AdminLog::with('admin:id,name')->latest()->orderByDesc('id')->limit(5)
                ->get()
                ->map(fn (AdminLog $log) => [
                    'id' => $log->id,
                    'description' => $log->description,
                    'admin' => $log->admin?->name,
                    'created_at' => $log->created_at->toIso8601String(),
                ]),
        ];
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\AdminLog;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Report;
use App\Models\Review;
use App\Models\SupportTicket;
use App\Models\TechnicianProfile;
use App\Models\User;
use App\Support\DashboardStats;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(): Response
    {
        $user = Auth::user();

        return match ($user->role) {
            'technician' => Inertia::render('Dashboard/Technician', $this->technicianData($user)),
            'admin' => Inertia::render('Dashboard/Admin', $this->adminStats()),
            default => Inertia::render('Dashboard/Customer', $this->customerData($user)),
        };
    }

    /**
     * Headline numbers, trends, charts and recent activity for the admin dashboard.
     *
     * @return array<string, mixed>
     */
    private function adminStats(): array
    {
        $reviews = Review::query();

        return [
            'stats' => [
                'users' => User::count(),
                'customers' => User::where('role', 'customer')->count(),
                'technicians' => User::where('role', 'technician')->count(),
                'suspended' => User::whereNotNull('suspended_at')->count(),
                'categories' => Category::count(),
                'conversations' => Conversation::count(),
                'reviews' => Review::count(),
                'tickets_open' => SupportTicket::whereIn('status', SupportTicket::ACTIVE_STATUSES)->count(),
                'reports_open' => Report::where('status', 'open')->count(),
                'average_rating' => DashboardStats::averageRating($reviews),
            ],
            // Last 30 days against the 30 days before, for the "vs previous period" figures.
            'trends' => [
                'users' => DashboardStats::trend(User::query()),
                'conversations' => DashboardStats::trend(Conversation::query()),
                'messages' => DashboardStats::trend(Message::query()),
                'reviews' => DashboardStats::trend(Review::query()),
            ],
            'charts' => [
                'signups' => DashboardStats::dailyCounts(User::query()),
                'messages' => DashboardStats::dailyCounts(Message::query()),
                'roles' => DashboardStats::countBy(User::query(), 'role', ['customer', 'technician', 'admin']),
                'ratings' => DashboardStats::ratingDistribution($reviews),
                'availability' => DashboardStats::countBy(
                    TechnicianProfile::query(),
                    'availability_status',
                    ['available', 'busy', 'offline'],
                ),
                'tickets' => DashboardStats::countBy(SupportTicket::query(), 'status', SupportTicket::STATUSES),
                'categories' => Category::query()
                    ->withCount('technicianProfiles')
                    ->get()
                    ->filter(fn (Category $category) => $category->technician_profiles_count > 0)
                    ->sortByDesc('technician_profiles_count')
                    ->take(8)
                    ->map(fn (Category $category) => [
                        'name' => $category->name,
                        'count' => $category->technician_profiles_count,
                    ])
                    ->values(),
            ],
            'recentUsers' => User::latest()->orderByDesc('id')->limit(5)
                ->get(['id', 'name', 'email', 'role', 'created_at', 'avatar_path']),
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

    /**
     * A technician's own numbers: inbox, reputation and the last 30 days of activity.
     *
     * @return array<string, mixed>
     */
    private function technicianData(User $user): array
    {
        $conversations = Conversation::query()->where('technician_id', $user->id);
        $messages = Message::query()->whereIn('conversation_id', Conversation::query()->where('technician_id', $user->id)->select('id'));
        $received = (clone $messages)->where('sender_id', '!=', $user->id);
        // Automatic replies are left out: these numbers are about what the technician wrote.
        $sent = (clone $messages)->where('sender_id', $user->id)->where('is_automated', false);
        $reviews = Review::query()->where('technician_id', $user->id);

        $total = (clone $conversations)->count();
        $replied = (clone $conversations)
            ->whereHas('messages', fn ($query) => $query->where('sender_id', $user->id)->where('is_automated', false))
            ->count();

        return [
            'stats' => [
                'conversations' => $total,
                'unread' => (clone $received)->visibleTo($user)->whereNull('deleted_for_everyone_at')->whereNull('read_at')->count(),
                'reviews' => (clone $reviews)->count(),
                'average_rating' => DashboardStats::averageRating($reviews),
                // Share of conversations the technician has written in, as a whole percentage.
                'reply_rate' => $total > 0 ? (int) round($replied / $total * 100) : null,
            ],
            'trends' => [
                'conversations' => DashboardStats::trend($conversations),
                'received' => DashboardStats::trend($received),
            ],
            'charts' => [
                'received' => DashboardStats::dailyCounts($received),
                'sent' => DashboardStats::dailyCounts($sent),
                'ratings' => DashboardStats::ratingDistribution($reviews),
            ],
            'recentReviews' => (clone $reviews)
                ->with('customer:id,name,avatar_path')
                ->latest()
                ->orderByDesc('id')
                ->limit(3)
                ->get()
                ->map(fn (Review $review) => [
                    'id' => $review->id,
                    'rating' => $review->rating,
                    'comment' => $review->comment,
                    'customer' => $review->customer
                        ? ['id' => $review->customer->id, 'name' => $review->customer->name, 'avatar_url' => $review->customer->avatar_url]
                        : null,
                    'created_at' => $review->created_at->toIso8601String(),
                ]),
        ];
    }

    /**
     * A customer's own numbers: inbox, the kinds of repair they looked for and their reviews.
     *
     * @return array<string, mixed>
     */
    private function customerData(User $user): array
    {
        $conversations = Conversation::query()->where('customer_id', $user->id);
        $messages = Message::query()->whereIn('conversation_id', Conversation::query()->where('customer_id', $user->id)->select('id'));
        $received = (clone $messages)->where('sender_id', '!=', $user->id);
        $sent = (clone $messages)->where('sender_id', $user->id);
        $reviews = Review::query()->where('customer_id', $user->id);

        $technicianIds = (clone $conversations)->pluck('technician_id');

        return [
            'stats' => [
                'conversations' => $technicianIds->count(),
                'unread' => (clone $received)->visibleTo($user)->whereNull('deleted_for_everyone_at')->whereNull('read_at')->count(),
                'reviews' => (clone $reviews)->count(),
                'tickets_open' => SupportTicket::where('user_id', $user->id)
                    ->whereIn('status', SupportTicket::ACTIVE_STATUSES)
                    ->count(),
            ],
            'charts' => [
                'sent' => DashboardStats::dailyCounts($sent),
                'received' => DashboardStats::dailyCounts($received),
                'ratings' => DashboardStats::ratingDistribution($reviews),
                // The kinds of repair this customer has asked technicians about.
                'categories' => Category::query()
                    ->withCount(['technicianProfiles as contacted_count' => fn ($query) => $query
                        ->whereIn('technician_profiles.user_id', $technicianIds)])
                    ->get()
                    ->filter(fn (Category $category) => $category->contacted_count > 0)
                    ->sortByDesc('contacted_count')
                    ->take(6)
                    ->map(fn (Category $category) => [
                        'name' => $category->name,
                        'count' => $category->contacted_count,
                    ])
                    ->values(),
            ],
        ];
    }
}

<?php

namespace App\Http\Middleware;

use App\Support\NotificationItem;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
            ],
            'notifications' => [
                'unread' => fn () => $request->user()?->unreadNotifications()->count() ?? 0,
                // The newest few, for the bell's dropdown (newest first).
                'recent' => fn () => $request->user()
                    ?->notifications()
                    ->limit(10)
                    ->get()
                    ->map(fn ($notification) => NotificationItem::make($notification))
                    ->all() ?? [],
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
            ],
        ];
    }
}

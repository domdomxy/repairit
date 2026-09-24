<?php

namespace App\Http\Middleware;

use App\Support\ConversationList;
use App\Support\NotificationItem;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
                // Sites this person let open without the "Leaving Repairit" prompt.
                // Shared by hand because the column is hidden on the model, so it
                // can never leak inside a user that is shown to someone else.
                'trusted_hosts' => $request->user()?->trusted_link_hosts ?? [],
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
            // The messages panel in the top bar: unread conversations, and the newest few of the inbox, requests and hidden.
            'inbox' => fn () => $request->user()
                ? ConversationList::panel($request->user())
                : ['unread' => 0, 'unread_requests' => 0, 'unread_hidden' => 0, 'recent' => [], 'requests' => [], 'hidden' => []],
            // What the last action wants to tell the person, shown as a toast (see Toaster.jsx).
            // The id is new on every response that has a message, so the page can tell a
            // fresh message from one it already showed (a partial reload keeps the old flash).
            'flash' => function () use ($request) {
                $messages = array_filter(
                    [
                        'success' => $request->session()->get('success'),
                        'error' => $request->session()->get('error'),
                        'warning' => $request->session()->get('warning'),
                        'info' => $request->session()->get('info'),
                    ],
                    fn ($message) => is_string($message) && $message !== '',
                );

                return $messages === [] ? null : $messages + ['id' => Str::random(8)];
            },
        ];
    }
}

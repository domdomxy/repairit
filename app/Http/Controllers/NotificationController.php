<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    public function index(Request $request): Response
    {
        $items = $request->user()
            ->notifications()
            ->paginate(15)
            ->through(fn (DatabaseNotification $notification) => [
                'id' => $notification->id,
                'kind' => $notification->data['kind'] ?? null,
                'title' => $notification->data['title'] ?? 'Notification',
                'body' => $notification->data['body'] ?? null,
                'read_at' => $notification->read_at?->toIso8601String(),
                'created_at' => $notification->created_at->toIso8601String(),
            ]);

        return Inertia::render('Notifications/Index', ['items' => $items]);
    }

    // Mark one notification read and continue to whatever it is about.
    public function read(Request $request, string $notification): RedirectResponse
    {
        // Scoped to the current user, so someone else's id is a 404.
        $notification = $request->user()->notifications()->findOrFail($notification);

        $notification->markAsRead();

        $url = $notification->data['url'] ?? null;

        // Only ever follow an in-app path.
        if (is_string($url) && str_starts_with($url, '/') && ! str_starts_with($url, '//')) {
            return redirect($url);
        }

        return back();
    }

    public function readAll(Request $request): RedirectResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return back();
    }
}

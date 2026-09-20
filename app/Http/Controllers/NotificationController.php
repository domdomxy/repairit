<?php

namespace App\Http\Controllers;

use App\Support\NotificationItem;
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
            ->through(fn (DatabaseNotification $notification) => NotificationItem::make($notification));

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

    // Delete one notification (scoped to the current user, so someone else's id is a 404).
    public function destroy(Request $request, string $notification): RedirectResponse
    {
        $request->user()->notifications()->findOrFail($notification)->delete();

        return back();
    }

    // Delete all of the current user's notifications.
    public function clear(Request $request): RedirectResponse
    {
        $request->user()->notifications()->delete();

        return back();
    }
}

<?php

namespace App\Support;

use Illuminate\Notifications\DatabaseNotification;

/**
 * How a stored notification is shown to the browser, for the bell's dropdown
 * and the notifications page alike. The link it points to stays on the server:
 * opening one goes through the `notifications.read` route, which only ever
 * follows in-app paths.
 */
class NotificationItem
{
    /** @return array<string, mixed> */
    public static function make(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'kind' => $notification->data['kind'] ?? null,
            'title' => $notification->data['title'] ?? 'Notification',
            'body' => $notification->data['body'] ?? null,
            'read_at' => $notification->read_at?->toIso8601String(),
            'created_at' => $notification->created_at->toIso8601String(),
        ];
    }
}

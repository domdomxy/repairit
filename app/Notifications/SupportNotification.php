<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Shared behaviour for everything the support system sends: the same three
 * channels as messages and reviews, and the same rule that emails never carry
 * what people wrote (they say what happened and link back to the ticket).
 */
abstract class SupportNotification extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public SupportTicket $ticket) {}

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /** The ticket page for the person who owns it. */
    protected function ownerUrl(bool $absolute): string
    {
        return route('support.show', $this->ticket, absolute: $absolute);
    }

    /** The ticket page in the admin area. */
    protected function staffUrl(bool $absolute): string
    {
        return route('admin.support.show', $this->ticket, absolute: $absolute);
    }
}

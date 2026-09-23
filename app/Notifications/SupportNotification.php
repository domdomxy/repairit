<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
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
        // A guest has no account to attach a database or broadcast notification
        // to — email, sent through the on-demand route, is all that reaches them.
        if ($notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    /** The ticket page for the person who owns it — a guest's link carries their access token. */
    protected function ownerUrl(bool $absolute): string
    {
        if ($this->ticket->isGuest()) {
            return route('support.guest.show', [
                'ticket' => $this->ticket->id,
                'token' => $this->ticket->guest_token,
            ], absolute: $absolute);
        }

        return route('support.show', $this->ticket, absolute: $absolute);
    }

    /** The ticket page in the admin area. */
    protected function staffUrl(bool $absolute): string
    {
        return route('admin.support.show', $this->ticket, absolute: $absolute);
    }
}

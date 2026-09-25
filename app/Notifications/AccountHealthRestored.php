<?php

namespace App\Notifications;

use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent once, when a user's last active warning ages out (90 days after it
 * was issued) and their account health status turns from "warned" back to
 * "good" on its own — not sent again for accounts that were already good.
 */
class AccountHealthRestored extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function via(object $notifiable): array
    {
        $channels = ['database', 'broadcast'];

        if ($notifiable->email_notifications) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'account_health_restored',
            'title' => 'Your account health status is back to good standing',
            'body' => 'Your last active warning expired after 90 days and no longer counts against your account.',
            'url' => route('relations.index', absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your '.config('app.name').' account is back to good standing')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line('The warning on your account has expired after 90 days and no longer counts against it.')
            ->line('Your account health status is back to good standing.')
            ->action('Check your account health', route('relations.index'))
            ->line('You can turn these emails off in your profile settings.');
    }
}

<?php

namespace App\Notifications;

use App\Models\UserWarning;
use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Sent when an admin warns a user, ahead of a possible suspension. Always
 * reaches them by database/broadcast (so it shows in the bell straight away)
 * and by mail unless they turned off email notifications — a warning
 * doesn't sign them out, so unlike AccountSuspended it can wait for the
 * account's own notification preference.
 */
class AccountWarned extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function __construct(public UserWarning $warning) {}

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
            'kind' => 'account_warning',
            'title' => 'An administrator has warned your account',
            'body' => Str::limit(preg_replace('/\s+/u', ' ', trim($this->warning->reason)), 160),
            'expires_at' => $this->warning->expires_at->toIso8601String(),
            'url' => route('relations.index', absolute: false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('An administrator has warned your '.config('app.name').' account')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line('An administrator has issued your account a warning:')
            ->line($this->warning->reason)
            ->line('Repeated or serious issues can lead to suspension. This warning stays on your account health status until '.$this->warning->expires_at->toFormattedDateString().'.')
            ->action('Check your account health', route('relations.index'))
            ->line('You can turn these emails off in your profile settings.');
    }
}

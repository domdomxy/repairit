<?php

namespace App\Notifications;

use App\Notifications\Concerns\PreparesMailText;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Email only, and sent regardless of the user's email preference: a suspended
 * user can no longer sign in, so this is the only way they find out why.
 */
class AccountSuspended extends Notification implements ShouldQueue
{
    use PreparesMailText, Queueable;

    public bool $deleteWhenMissingModels = true;

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your '.config('app.name').' account has been suspended')
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line('An administrator has suspended your account. You are signed out, cannot log in, and are hidden from search until it is restored.')
            ->line('If you think this is a mistake, write to us at '.config('mail.support.address').' and explain what happened.')
            ->replyTo(config('mail.support.address'));
    }
}

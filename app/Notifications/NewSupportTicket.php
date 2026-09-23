<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;

/** Sent to admins when someone opens a ticket. */
class NewSupportTicket extends SupportNotification
{
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'support',
            'title' => "New support ticket from {$this->ticket->ownerName()}",
            'body' => "{$this->ticket->categoryLabel()}: {$this->ticket->subject}",
            'ticket_id' => $this->ticket->id,
            'url' => $this->staffUrl(false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("New support ticket {$this->ticket->tracking_id}")
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line($this->escapeForMail($this->ticket->ownerName())." opened a support ticket ({$this->ticket->tracking_id}, {$this->ticket->categoryLabel()}).")
            ->action('Open the ticket', $this->staffUrl(true))
            ->line('You can turn these emails off in your profile settings.');
    }
}

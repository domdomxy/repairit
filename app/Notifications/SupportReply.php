<?php

namespace App\Notifications;

use App\Models\SupportMessage;
use App\Models\SupportTicket;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Str;

/**
 * A new reply on a ticket. A staff reply goes to the ticket's owner; a reply
 * from the owner goes to the admins. The message itself says which, so the
 * link and wording follow it rather than the recipient's role (an admin can
 * own a ticket too).
 */
class SupportReply extends SupportNotification
{
    public function __construct(SupportTicket $ticket, public SupportMessage $message, public ?string $newStatus = null)
    {
        parent::__construct($ticket);
    }

    public function toArray(object $notifiable): array
    {
        $tracking = $this->ticket->tracking_id;

        return [
            'kind' => 'support',
            'title' => $this->message->from_staff
                ? "Support replied to your ticket {$tracking}"
                : "{$this->message->author?->name} replied to ticket {$tracking}",
            'body' => Str::limit(preg_replace('/\s+/u', ' ', trim($this->message->body)), 120),
            'ticket_id' => $this->ticket->id,
            'status' => $this->newStatus,
            'url' => $this->message->from_staff ? $this->ownerUrl(false) : $this->staffUrl(false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tracking = $this->ticket->tracking_id;
        $mail = (new MailMessage)->greeting('Hi '.$this->escapeForMail($notifiable->name).',');

        if ($this->message->from_staff) {
            return $mail
                ->subject("Support replied to your ticket {$tracking}")
                ->line("Our team replied to your support ticket ({$tracking}).")
                ->action('Read the reply', $this->ownerUrl(true))
                ->line('You can turn these emails off in your profile settings.');
        }

        return $mail
            ->subject("New reply on ticket {$tracking}")
            ->line($this->escapeForMail($this->message->author?->name ?? 'A user')." replied to ticket {$tracking}.")
            ->action('Open the ticket', $this->staffUrl(true))
            ->line('You can turn these emails off in your profile settings.');
    }
}

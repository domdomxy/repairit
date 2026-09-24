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
                : "{$this->ticket->ownerName()} replied to ticket {$tracking}",
            // A reply that is only pictures has no text to show.
            'body' => trim($this->message->body) === ''
                ? 'Sent a picture'
                : Str::limit(preg_replace('/\s+/u', ' ', trim($this->message->body)), 120),
            'ticket_id' => $this->ticket->id,
            'status' => $this->newStatus,
            'url' => $this->message->from_staff ? $this->ownerUrl(false) : $this->staffUrl(false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $tracking = $this->ticket->tracking_id;

        if ($this->message->from_staff) {
            // The recipient here is the ticket's owner, who may be a guest with
            // no account (and so no ->name of their own) — greet by ticket owner.
            return (new MailMessage)
                ->greeting('Hi '.$this->escapeForMail($this->ticket->ownerName()).',')
                ->subject("Support replied to your ticket {$tracking}")
                ->line("Our team replied to your support ticket ({$tracking}).")
                ->action('Read the reply', $this->ownerUrl(true))
                ->line($this->ticket->isGuest()
                    ? 'This link is how you read and reply — there is no account or notification tied to this ticket.'
                    : 'You can turn these emails off in your profile settings.');
        }

        return (new MailMessage)
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->subject("New reply on ticket {$tracking}")
            ->line($this->escapeForMail($this->ticket->ownerName())." replied to ticket {$tracking}.")
            ->action('Open the ticket', $this->staffUrl(true))
            ->line('You can turn these emails off in your profile settings.');
    }
}

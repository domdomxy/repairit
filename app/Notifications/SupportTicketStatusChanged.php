<?php

namespace App\Notifications;

use App\Models\SupportTicket;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Str;

/** Tells the ticket's owner that staff changed its status without writing a reply. */
class SupportTicketStatusChanged extends SupportNotification
{
    public function __construct(SupportTicket $ticket, public string $status)
    {
        parent::__construct($ticket);
    }

    private function label(): string
    {
        return Str::of($this->status)->replace('_', ' ')->lower()->toString();
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'support',
            'title' => "Your ticket {$this->ticket->tracking_id} is now {$this->label()}",
            'body' => $this->ticket->subject,
            'ticket_id' => $this->ticket->id,
            'status' => $this->status,
            'url' => $this->ownerUrl(false),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Your ticket {$this->ticket->tracking_id} is now {$this->label()}")
            ->greeting('Hi '.$this->escapeForMail($notifiable->name).',')
            ->line("The status of your support ticket ({$this->ticket->tracking_id}) changed to {$this->label()}.")
            ->action('View the ticket', $this->ownerUrl(true))
            ->line('You can turn these emails off in your profile settings.');
    }
}

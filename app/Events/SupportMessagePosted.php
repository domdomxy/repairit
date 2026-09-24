<?php

namespace App\Events;

use App\Models\SupportMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A message was added to a support ticket (by the person asking for help,
 * by staff, or an automatic one). Fired by SupportMessage itself, so every
 * way of adding a message is covered, and only after the transaction that
 * wrote it commits, so the page that reacts can already read it.
 *
 * It carries no text: what a viewer may see differs (staff appear as
 * "Support team", picture links depend on who is looking), so the open page
 * just fetches the conversation again.
 */
class SupportMessagePosted implements ShouldBroadcast, ShouldDispatchAfterCommit
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public SupportMessage $message) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('support.ticket.'.$this->message->support_ticket_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.posted';
    }

    public function broadcastWith(): array
    {
        return [
            'ticket_id' => $this->message->support_ticket_id,
            'message_id' => $this->message->id,
            'from_staff' => $this->message->from_staff,
            // Lets the writer's own page skip fetching what it just sent.
            'user_id' => $this->message->user_id,
        ];
    }
}

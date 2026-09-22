<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** The sender edited a message, or either person pinned/unpinned one: the other person's open conversation updates in place. */
class MessageUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('conversation.' . $this->message->conversation_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'message.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'body' => $this->message->body,
            'edited_at' => $this->message->edited_at?->toIso8601String(),
            // A quote's card changes when the quote is edited or deleted (null for any other message).
            'quote' => $this->message->sharedQuote(),
            'pinned_at' => $this->message->pinned_at?->toIso8601String(),
            'pinned_by' => $this->message->pinned_at !== null ? $this->message->pinnedBy?->name : null,
        ];
    }
}

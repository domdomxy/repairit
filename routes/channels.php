<?php

use App\Models\Conversation;
use App\Models\SupportTicket;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);

    if (! $conversation) {
        return false;
    }

    return $user->id === $conversation->customer_id
        || $user->id === $conversation->technician_id;
});

// A support ticket's live channel: new messages and the "typing" whisper between
// the person who asked for help and the admins. Guests never subscribe (they have
// no account to authorize with), so only the ticket's owner and admins get in.
Broadcast::channel('support.ticket.{ticketId}', function ($user, $ticketId) {
    $ticket = SupportTicket::find($ticketId);

    if (! $ticket) {
        return false;
    }

    return $user->isAdmin() || $ticket->user_id === $user->id;
});

// Where a user's notifications are pushed live (Laravel's default naming).
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

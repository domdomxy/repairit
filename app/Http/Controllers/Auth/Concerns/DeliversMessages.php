<?php

namespace App\Http\Controllers\Concerns;

use App\Events\InboxUpdated;
use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\ConversationState;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewMessage;

/**
 * What happens once messages are stored, whichever controller stored them (a
 * written message, a shared offer or request, a quote sent in the chat).
 */
trait DeliversMessages
{
    /**
     * Everything that follows once a person's messages are stored: the
     * conversation moves up, comes back from "hidden" for the sender, the other
     * person is told (live, in their messages panel, and by email), and the
     * technician's automatic reply goes out if this was the customer's first
     * message.
     *
     * @param  array<int, Message>  $messages  Just created, oldest first.
     * @param  bool  $notify  Off when the recipient is already told another way (a quote has its own notification).
     */
    private function deliver(Conversation $conversation, User $sender, array $messages, bool $isCustomersFirstMessage, bool $notify = true): void
    {
        foreach ($messages as $message) {
            $message->load('attachments', 'offer.media', 'serviceRequest.media', 'quote');
        }

        $lastMessage = end($messages);

        $conversation->update(['last_message_at' => $lastMessage->created_at]);

        // Writing in a conversation you had hidden brings it back to your list.
        ConversationState::where('conversation_id', $conversation->id)
            ->where('user_id', $sender->id)
            ->whereNotNull('hidden_at')
            ->update(['hidden_at' => null]);

        foreach ($messages as $message) {
            broadcast(new MessageSent($message))->toOthers();
        }

        // Their messages panel, wherever they are on the site.
        broadcast(new InboxUpdated($conversation->participantFor($sender)->id));

        // Tell the recipient once per unread stretch rather than for every line
        // of a back-and-forth: if they already have an unread message from this
        // sender, they have been told.
        $alreadyNotified = $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_id', $sender->id)
            ->where('id', '<', $lastMessage->id)
            ->exists();

        if ($notify && ! $alreadyNotified) {
            $conversation->participantFor($sender)->notify(new NewMessage($lastMessage));
        }

        if ($isCustomersFirstMessage) {
            $this->sendAutoReply($conversation);
        }
    }

    /**
     * The technician's automatic answer to a customer's first message, if they
     * turned it on. It is written as the technician, marked as automated (so it
     * doesn't count as a real reply: the chat stays a request, and it doesn't
     * unlock reviews or raise their reply rate), and doesn't notify the customer,
     * who is looking at the conversation they just wrote in.
     */
    private function sendAutoReply(Conversation $conversation): void
    {
        $technician = $conversation->technician;
        $profile = $technician?->technicianProfile;

        if (! $profile?->auto_reply_enabled) {
            return;
        }

        $body = $profile->autoReplyFor($conversation->customer);

        if ($body === '') {
            return;
        }

        $reply = $conversation->messages()->create([
            'sender_id' => $technician->id,
            'body' => $body,
            'is_automated' => true,
        ]);

        $conversation->update(['last_message_at' => $reply->created_at]);

        // The customer's own page already gets this in the response to their
        // message; everyone else in the conversation (the technician, if they
        // have it open) gets it live.
        broadcast(new MessageSent($reply))->toOthers();
    }
}

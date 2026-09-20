<?php

namespace App\Support;

use App\Models\Conversation;
use App\Models\ConversationState;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * A person's conversations as the messages page and the messages panel in the
 * top bar show them.
 */
class ConversationList
{
    /**
     * The user's conversations for the list on the left, newest first.
     *
     * Each carries `unread_count`, `last_message` (a short preview), `is_hidden`
     * and `is_request`: true for a technician's conversations where a customer
     * has written but the technician has not answered yet. Replying moves it out
     * of "Requests" into the inbox. Conversations a user started themselves,
     * and ones with nothing in them yet, are never requests.
     *
     * Everything here is counted from what this person can still see: messages
     * they deleted for themselves, or that the sender deleted for everyone, are
     * not unread and are not "incoming". A conversation they deleted stays out of
     * the list until something new arrives in it.
     *
     * @return Collection<int, Conversation>
     */
    public static function for(User $user): Collection
    {
        $states = ConversationState::where('user_id', $user->id)->get()->keyBy('conversation_id');

        $conversations = Conversation::where(fn ($query) => $query
            ->where('customer_id', $user->id)
            ->orWhere('technician_id', $user->id))
            ->with(['customer:id,name,avatar_path', 'technician:id,name,avatar_path'])
            ->withCount([
                'messages as unread_count' => fn ($query) => $query
                    ->visibleTo($user)
                    ->whereNull('deleted_for_everyone_at')
                    ->whereNull('read_at')
                    ->where('sender_id', '!=', $user->id),
                'messages as visible_count' => fn ($query) => $query->visibleTo($user),
            ])
            ->withExists([
                'messages as has_incoming' => fn ($query) => $query
                    ->visibleTo($user)
                    ->whereNull('deleted_for_everyone_at')
                    ->where('sender_id', '!=', $user->id),
                // An automatic reply isn't an answer: the request stays a request.
                'messages as has_replied' => fn ($query) => $query
                    ->where('sender_id', $user->id)
                    ->where('is_automated', false),
            ])
            ->orderByDesc('last_message_at')
            ->get()
            // A deleted conversation stays gone until something new shows up in it.
            ->reject(fn (Conversation $conversation) => $states->get($conversation->id)?->cleared_at !== null
                && (int) $conversation->visible_count === 0)
            ->values();

        // The newest message this person can see in every conversation, in one query.
        $latest = Message::whereIn(
            'id',
            Message::visibleTo($user)
                // A technician's list shows what the customer wrote, not their own auto-reply.
                ->where(fn ($query) => $query
                    ->where('is_automated', false)
                    ->orWhere('sender_id', '!=', $user->id))
                ->whereIn('conversation_id', $conversations->modelKeys())
                ->selectRaw('MAX(id)')
                ->groupBy('conversation_id')
        )
            ->withCount('attachments')
            ->get()
            ->keyBy('conversation_id');

        return $conversations->each(function (Conversation $conversation) use ($user, $latest, $states) {
            $message = $latest->get($conversation->id);

            $conversation->setAttribute(
                'is_request',
                $conversation->technician_id === $user->id && $conversation->has_incoming && ! $conversation->has_replied
            );
            $conversation->setAttribute('is_hidden', $states->get($conversation->id)?->hidden_at !== null);
            $conversation->setAttribute('last_message', $message ? [
                'preview' => self::preview($message),
                'from_me' => $message->sender_id === $user->id,
                'created_at' => $message->created_at->toIso8601String(),
            ] : null);
            $conversation->makeHidden(['has_incoming', 'has_replied', 'visible_count']);
        });
    }

    /** One line for the list; a message with only files has no text. */
    private static function preview(Message $message): ?string
    {
        if ($message->isDeletedForEveryone()) {
            return 'This message was deleted';
        }

        $text = trim((string) $message->body);

        if ($text !== '') {
            return Str::limit(preg_replace('/\s+/u', ' ', $text), 80);
        }

        return match (true) {
            $message->attachments_count === 0 => null,
            $message->attachments_count === 1 => 'Sent an attachment',
            default => "Sent {$message->attachments_count} attachments",
        };
    }

    /**
     * What the messages panel in the top bar shows, split like the messages
     * page: `recent` is the inbox, `requests` the conversations a customer
     * started that the technician hasn't answered yet. Each holds the newest
     * few, and `unread` (both together) and `unread_requests` count
     * conversations with something unread, over all of them rather than just
     * the ones listed.
     *
     * Hidden conversations stay out of all of it (they are on the person's
     * "Hidden" tab), and so do ones with nothing in them yet.
     *
     * @return array{unread: int, unread_requests: int, recent: list<array<string, mixed>>, requests: list<array<string, mixed>>}
     */
    public static function panel(User $user, int $limit = 8): array
    {
        $visible = self::for($user)
            ->reject(fn (Conversation $conversation) => $conversation->is_hidden || $conversation->last_message === null)
            ->values();

        [$requests, $inbox] = $visible->partition(fn (Conversation $conversation) => $conversation->is_request);

        $unreadIn = fn (Collection $group) => $group->filter(fn (Conversation $conversation) => $conversation->unread_count > 0)->count();

        $present = fn (Collection $group) => $group
            ->take($limit)
            ->map(function (Conversation $conversation) use ($user) {
                $other = $conversation->customer_id === $user->id ? $conversation->technician : $conversation->customer;

                return [
                    'id' => $conversation->id,
                    'name' => $other?->name,
                    'avatar_url' => $other?->avatar_url,
                    'unread_count' => (int) $conversation->unread_count,
                    'is_request' => (bool) $conversation->is_request,
                    'last_message' => $conversation->last_message,
                ];
            })
            ->values()
            ->all();

        return [
            'unread' => $unreadIn($visible),
            'unread_requests' => $unreadIn($requests),
            'recent' => $present($inbox),
            'requests' => $present($requests),
        ];
    }
}

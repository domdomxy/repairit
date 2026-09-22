<?php

namespace App\Support;

use App\Models\Conversation;
use App\Models\ConversationState;
use App\Models\Message;
use App\Models\User;
use App\Models\UserRelation;
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
     * Each carries `unread_count`, `last_message` (a short preview), `is_hidden`,
     * `is_pinned` (pinned conversations are listed first; this is a per-conversation
     * choice, unrelated to favoriting a user for the technician search) and
     * `is_request`: true for a technician's conversations where a customer
     * has written but the technician has not answered yet (replying moves it out
     * of "Requests" into the inbox), and for anyone this person restricted who has
     * written to them (only unrestricting moves those out). Conversations a user
     * started themselves, and ones with nothing in them yet, are never requests.
     *
     * It also carries what this person did about the other one: `is_muted`,
     * `is_restricted` and `is_blocked`.
     *
     * A conversation with nothing this person can see in it yet - most notably
     * the empty row created the moment someone clicks "Message" on a profile,
     * before they've actually sent anything - is left out entirely, for
     * everyone involved. It starts showing up (for both people) once a
     * message actually lands in it.
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

        // What this person did about the people they talk to, keyed by that person: ['block', 'mute', ...].
        $relations = UserRelation::where('user_id', $user->id)
            ->get()
            ->groupBy('target_id')
            ->map(fn (Collection $rows) => $rows->pluck('type')->all());

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
            // A conversation with nothing this person can see in it yet doesn't
            // belong in their list - most importantly, the empty conversation
            // row created the moment someone clicks "Message" on a profile:
            // that should only surface for the other person once something is
            // actually sent into it, not immediately in their inbox.
            ->reject(fn (Conversation $conversation) => (int) $conversation->visible_count === 0)
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

        return $conversations->each(function (Conversation $conversation) use ($user, $latest, $states, $relations) {
            $message = $latest->get($conversation->id);

            $otherId = $conversation->customer_id === $user->id ? $conversation->technician_id : $conversation->customer_id;
            $mine = $relations->get($otherId, []);
            $restricted = in_array(UserRelation::RESTRICT, $mine, true);

            $conversation->setAttribute(
                'is_request',
                ($restricted && $conversation->has_incoming)
                    || ($conversation->technician_id === $user->id && $conversation->has_incoming && ! $conversation->has_replied)
            );
            $conversation->setAttribute('is_pinned', $states->get($conversation->id)?->pinned_at !== null);
            $conversation->setAttribute('is_muted', in_array(UserRelation::MUTE, $mine, true));
            $conversation->setAttribute('is_restricted', $restricted);
            $conversation->setAttribute('is_blocked', in_array(UserRelation::BLOCK, $mine, true));
            $conversation->setAttribute('is_hidden', $states->get($conversation->id)?->hidden_at !== null);
            $conversation->setAttribute('last_message', $message ? [
                'preview' => self::preview($message),
                'from_me' => $message->sender_id === $user->id,
                'created_at' => $message->created_at->toIso8601String(),
                // Only meaningful when `from_me` is true: null until the other
                // person has opened the conversation and read it.
                'read_at' => $message->read_at?->toIso8601String(),
            ] : null);
            $conversation->makeHidden(['has_incoming', 'has_replied', 'visible_count']);
        })
            // Pinned first; the sort is stable, so each group stays newest first.
            ->sortBy(fn (Conversation $conversation) => $conversation->is_pinned ? 0 : 1)
            ->values();
    }

    /** One line for the list; a message with only files, or a shared offer, request or quote, has no text. */
    private static function preview(Message $message): ?string
    {
        if ($message->isDeletedForEveryone()) {
            return 'This message was deleted';
        }

        $text = trim((string) $message->body);

        if ($text !== '') {
            return Str::limit(preg_replace('/\s+/u', ' ', $text), 80);
        }

        if ($message->offer_title !== null) {
            return Str::limit('Shared an offer: '.$message->offer_title, 80);
        }

        if ($message->quote_price !== null) {
            return Str::limit('Sent a quote: '.$message->quote_price, 80);
        }

        if ($message->request_excerpt !== null) {
            return Str::limit('Shared a request: '.$message->request_excerpt, 80);
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
     * started that the technician hasn't answered yet, and `hidden` the ones
     * this person hid. Each holds the newest few, and `unread`,
     * `unread_requests` and `unread_hidden` count conversations with
     * something unread, over all of them rather than just the ones listed.
     * `unread` (the bell's badge) counts only the inbox and requests, not
     * hidden conversations.
     *
     * Conversations with nothing in them yet are left out of all three groups.
     *
     * @return array{unread: int, unread_requests: int, unread_hidden: int, recent: list<array<string, mixed>>, requests: list<array<string, mixed>>, hidden: list<array<string, mixed>>}
     */
    public static function panel(User $user, int $limit = 8): array
    {
        $all = self::for($user)
            ->reject(fn (Conversation $conversation) => $conversation->last_message === null)
            ->values();

        $visible = $all->reject(fn (Conversation $conversation) => $conversation->is_hidden)->values();
        $hidden = $all->filter(fn (Conversation $conversation) => $conversation->is_hidden)->values();

        [$requests, $inbox] = $visible->partition(fn (Conversation $conversation) => $conversation->is_request);

        // Muted and restricted people don't add to the badge: that is what muting is for.
        $unreadIn = fn (Collection $group) => $group
            ->filter(fn (Conversation $conversation) => $conversation->unread_count > 0 && ! $conversation->is_muted && ! $conversation->is_restricted)
            ->count();

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
                    'is_pinned' => (bool) $conversation->is_pinned,
                    'is_muted' => (bool) $conversation->is_muted,
                    'is_restricted' => (bool) $conversation->is_restricted,
                    'last_message' => $conversation->last_message,
                ];
            })
            ->values()
            ->all();

        return [
            'unread' => $unreadIn($visible),
            'unread_requests' => $unreadIn($requests),
            'unread_hidden' => $unreadIn($hidden),
            'recent' => $present($inbox),
            'requests' => $present($requests),
            'hidden' => $present($hidden),
        ];
    }
}

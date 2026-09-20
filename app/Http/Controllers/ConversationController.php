<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Notifications\NewMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Inertia;

class ConversationController extends Controller
{
    // The messages page with nothing open: just the list on the left
    public function index()
    {
        return Inertia::render('Messages/Index', [
            'conversations' => $this->listFor(Auth::user()),
        ]);
    }

    // Start (or reopen) a conversation with a technician, then redirect into it
    public function startWith(User $technician)
    {
        abort_unless($technician->role === 'technician' && ! $technician->isSuspended(), 404);

        $customer = Auth::user();
        abort_if($customer->id === $technician->id, 403);

        $conversation = Conversation::firstOrCreate([
            'customer_id' => $customer->id,
            'technician_id' => $technician->id,
        ]);

        return redirect()->route('conversations.show', $conversation);
    }

    public function show(Conversation $conversation)
    {
        $user = Auth::user();
        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        $conversation->load(['customer:id,name,avatar_path', 'technician:id,name,avatar_path']);

        $messages = $conversation->messages()
            ->with(['sender:id,name', 'attachments'])
            ->orderBy('created_at')
            ->get();

        // Mark incoming messages as read
        $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_id', '!=', $user->id)
            ->update(['read_at' => now()]);

        $user->unreadNotifications()
            ->where('type', NewMessage::class)
            ->get()
            ->filter(fn ($notification) => ($notification->data['conversation_id'] ?? null) === $conversation->id)
            ->each->markAsRead();

        // Built after the messages are marked read, so the open conversation
        // shows no unread count.
        $conversations = $this->listFor($user);
        $conversation->setAttribute('is_request', (bool) $conversations->firstWhere('id', $conversation->id)?->is_request);

        return Inertia::render('Messages/Show', [
            'conversation' => $conversation,
            'conversations' => $conversations,
            'contact' => $this->contactFor($conversation, $user),
            'messages' => $messages,
            // What the composer offers: the limits and the extensions it lets through.
            'attachments' => [
                'max_kb' => Message::ATTACHMENT_MAX_KB,
                'max_files' => Message::ATTACHMENT_MAX_FILES,
                'max_total_kb' => Message::ATTACHMENT_MAX_TOTAL_KB,
                'extensions' => Message::ATTACHMENT_EXTENSIONS,
            ],
        ]);
    }

    /**
     * The user's conversations for the list on the left, newest first.
     *
     * Each carries `unread_count`, `last_message` (a short preview) and
     * `is_request`: true for a technician's conversations where a customer has
     * written but the technician has not answered yet. Replying moves it out
     * of "Requests" into the inbox. Conversations a user started themselves,
     * and ones with nothing in them yet, are never requests.
     *
     * @return Collection<int, Conversation>
     */
    private function listFor(User $user): Collection
    {
        $conversations = Conversation::where('customer_id', $user->id)
            ->orWhere('technician_id', $user->id)
            ->with(['customer:id,name,avatar_path', 'technician:id,name,avatar_path'])
            ->withCount(['messages as unread_count' => function ($query) use ($user) {
                $query->whereNull('read_at')->where('sender_id', '!=', $user->id);
            }])
            ->withExists([
                'messages as has_incoming' => fn ($query) => $query->where('sender_id', '!=', $user->id),
                'messages as has_replied' => fn ($query) => $query->where('sender_id', $user->id),
            ])
            ->orderByDesc('last_message_at')
            ->get();

        // The newest message of every conversation, in one query.
        $latest = Message::whereIn(
            'id',
            Message::whereIn('conversation_id', $conversations->modelKeys())
                ->selectRaw('MAX(id)')
                ->groupBy('conversation_id')
        )
            ->withCount('attachments')
            ->get()
            ->keyBy('conversation_id');

        return $conversations->each(function (Conversation $conversation) use ($user, $latest) {
            $message = $latest->get($conversation->id);

            $conversation->setAttribute(
                'is_request',
                $conversation->technician_id === $user->id && $conversation->has_incoming && ! $conversation->has_replied
            );
            $conversation->setAttribute('last_message', $message ? [
                'preview' => $this->preview($message),
                'from_me' => $message->sender_id === $user->id,
                'created_at' => $message->created_at->toIso8601String(),
            ] : null);
            $conversation->makeHidden(['has_incoming', 'has_replied']);
        });
    }

    /** One line for the list; a message with only files has no text. */
    private function preview(Message $message): ?string
    {
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
     * What the panel on the right shows about the person on the other side.
     *
     * Only what is already public on their profile page: a technician's phone
     * and email appear only if they chose to show them, and a customer's
     * contact details never do. A suspended account shows just a name.
     *
     * @return array<string, mixed>
     */
    private function contactFor(Conversation $conversation, User $viewer): array
    {
        // Loaded afresh: the conversation's own copy only has a few columns.
        $other = User::with('technicianProfile.categories')
            ->findOrFail($conversation->participantFor($viewer)->id);

        $isTechnician = $other->id === $conversation->technician_id;

        $contact = [
            'id' => $other->id,
            'name' => $other->name,
            'avatar_url' => $other->avatar_url,
            'role' => $isTechnician ? 'technician' : 'customer',
            'suspended' => $other->isSuspended(),
            'member_since' => $other->created_at?->toIso8601String(),
            'profile' => null,
            'email' => null,
        ];

        $profile = $other->technicianProfile;

        if ($isTechnician && $profile && ! $other->isSuspended()) {
            $contact['profile'] = [
                'city' => $profile->city,
                'availability_status' => $profile->availability_status,
                'rating_avg' => $profile->rating_avg,
                'rating_count' => $profile->rating_count,
                'bio' => $profile->bio,
                'categories' => $profile->categories->pluck('name')->values()->all(),
                'phone' => $profile->show_phone_publicly ? $profile->phone : null,
            ];
            $contact['email'] = $profile->show_email_publicly ? $other->email : null;
        }

        return $contact;
    }
}

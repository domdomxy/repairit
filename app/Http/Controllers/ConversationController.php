<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationState;
use App\Models\Message;
use App\Models\Quote;
use App\Models\Report;
use App\Models\User;
use App\Support\ConversationList;
use App\Support\ProfileLinks;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ConversationController extends Controller
{
    // The messages page with nothing open: just the list on the left
    public function index()
    {
        return Inertia::render('Messages/Index', [
            'conversations' => ConversationList::for(Auth::user()),
        ]);
    }

    // Start (or reopen) a conversation with a technician, then redirect into it
    public function startWith(User $technician)
    {
        abort_unless($technician->role === 'technician' && ! $technician->isSuspended(), 404);

        $customer = Auth::user();
        abort_if($customer->id === $technician->id, 403);
        abort_if($customer->isBlockedWith($technician), 403, 'You can no longer send messages to or from this person.');

        $conversation = Conversation::firstOrCreate([
            'customer_id' => $customer->id,
            'technician_id' => $technician->id,
        ]);

        // Reaching out again to someone you had hidden brings them back to your list.
        ConversationState::where('conversation_id', $conversation->id)
            ->where('user_id', $customer->id)
            ->whereNotNull('hidden_at')
            ->update(['hidden_at' => null]);

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

        // What this person can see: not what they deleted for themselves, and
        // nothing from before they deleted the conversation. Messages deleted
        // for everyone come through as placeholders (see Message::forClient).
        $messages = $conversation->messages()
            ->visibleTo($user)
            ->with(['sender:id,name', 'attachments', 'offer.media', 'serviceRequest.media', 'quote', 'replyTo.sender:id,name', 'replyTo.attachments'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Message $message) => $message->forClient())
            ->all();

        // Mark incoming messages as read
        $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_id', '!=', $user->id)
            ->update(['read_at' => now()]);

        // Built after the messages are marked read, so the open conversation
        // shows no unread count.
        $conversations = ConversationList::for($user);
        // Reports this person already filed here, so the menus don't offer them twice.
        $reports = Report::where('conversation_id', $conversation->id)
            ->where('reporter_id', $user->id)
            ->where('status', 'open')
            ->get(['id', 'message_id']);

        $listed = $conversations->firstWhere('id', $conversation->id);
        $conversation->setAttribute('is_request', (bool) $listed?->is_request);
        $conversation->setAttribute('is_hidden', (bool) $listed?->is_hidden);
        $conversation->setAttribute('is_pinned', (bool) $listed?->is_pinned);
        $conversation->setAttribute('is_restricted', (bool) $listed?->is_restricted);

        return Inertia::render('Messages/Show', [
            'conversation' => $conversation,
            'conversations' => $conversations,
            'contact' => $this->contactFor($conversation, $user),
            'messages' => $messages,
            'moderation' => [
                'reported_conversation' => $reports->whereNull('message_id')->isNotEmpty(),
                'reported_message_ids' => $reports->pluck('message_id')->filter()->values()->all(),
                'reasons' => Report::REASONS,
            ],
            // What a technician's quote card needs to be edited from the chat.
            'quoteLimits' => Quote::limits(),
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
     * What the panel on the right shows about the person on the other side.
     *
     * Only what is already public on their profile page: a phone number and an
     * email appear only if their owner chose to show them, and the links are
     * the ones on the profile. A suspended account shows just a name.
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
            // What the viewer did about this person (null for admins, who can't be blocked or muted).
            'relations' => $other->isAdmin() ? null : $viewer->relationFlagsFor($other),
            // False once either of them blocked the other: the chat stays readable but nobody can write.
            'can_message' => ! $viewer->isBlockedWith($other),
            'member_since' => $other->created_at?->toIso8601String(),
            'profile' => null,
            'email' => null,
            'phone' => null,
            'links' => [],
        ];

        if (! $other->isSuspended()) {
            $contact['links'] = ProfileLinks::list($other->links);
        }

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

        // A customer's rating comes from what technicians wrote about them.
        if (! $isTechnician && ! $other->isSuspended()) {
            // A customer's phone and email are there only if they chose to show them.
            $contact['phone'] = $other->show_phone_publicly && filled($other->phone) ? $other->phone : null;
            $contact['email'] = $other->show_email_publicly ? $other->email : null;

            $stats = $other->customerReviewsReceived()
                ->selectRaw('COUNT(*) as total, AVG(rating) as average')
                ->first();

            $contact['rating_count'] = (int) $stats->total;
            $contact['rating_avg'] = $stats->total ? round((float) $stats->average, 2) : null;
        }

        return $contact;
    }

    /** Move a conversation out of the list into "Hidden". The other person isn't told. */
    public function hide(Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless($conversation->hasParticipant($user), 403);

        $conversation->updateStateFor($user, ['hidden_at' => now()]);

        return redirect()
            ->route('conversations.index')
            ->with('success', 'Conversation hidden. You can find it under Hidden.');
    }

    public function unhide(Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless($conversation->hasParticipant($user), 403);

        $conversation->updateStateFor($user, ['hidden_at' => null]);

        return back()->with('success', 'Conversation moved back to your list.');
    }

    /**
     * Pin a conversation to the top of this person's own list (inbox, requests
     * and the messages panel alike). Never shown to the other person, and
     * unrelated to favoriting a user for the technician search.
     */
    public function pin(Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless($conversation->hasParticipant($user), 403);

        $conversation->updateStateFor($user, ['pinned_at' => now()]);

        return back()->with('success', 'Conversation pinned.');
    }

    public function unpin(Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless($conversation->hasParticipant($user), 403);

        $conversation->updateStateFor($user, ['pinned_at' => null]);

        return back()->with('success', 'Conversation unpinned.');
    }

    /**
     * Delete a conversation for the person asking, and only for them. Its history
     * is cleared from their side; the other person keeps everything, and if either
     * of them writes again the conversation returns with only the new messages.
     *
     * Nothing is removed from the database, so a reported chat can still be read
     * by an admin in full.
     */
    public function destroy(Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless($conversation->hasParticipant($user), 403);

        $conversation->updateStateFor($user, [
            'hidden_at' => null,
            'cleared_at' => now(),
            'cleared_through_message_id' => $conversation->messages()->max('id') ?? 0,
        ]);

        return redirect()
            ->route('conversations.index')
            ->with('success', 'Conversation deleted.');
    }
}

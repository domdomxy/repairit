<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\Report;
use App\Models\User;
use App\Notifications\NewReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/** Reporting from inside a conversation: one message, or the whole chat. */
class ReportController extends Controller
{
    /** Report a message the other person sent. */
    public function storeMessage(Request $request, Message $message): RedirectResponse
    {
        $user = $request->user();
        $conversation = $message->conversation;

        abort_unless($conversation->hasParticipant($user), 403);
        abort_if($message->sender_id === $user->id, 403, 'You cannot report your own message.');

        // Only what this person could see: not a message they already deleted
        // for themselves, or from before they deleted the conversation.
        abort_unless(Message::whereKey($message->id)->visibleTo($user)->exists(), 404);

        return $this->file($request, $conversation, $message->sender_id, $message);
    }

    /** Report the conversation as a whole. */
    public function storeConversation(Request $request, Conversation $conversation): RedirectResponse
    {
        $user = $request->user();

        abort_unless($conversation->hasParticipant($user), 403);

        return $this->file($request, $conversation, $conversation->participantFor($user)->id, null);
    }

    private function file(Request $request, Conversation $conversation, int $reportedUserId, ?Message $message): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'reason' => ['required', Rule::in(array_keys(Report::REASONS))],
            'details' => ['nullable', 'string', 'max:1000'],
        ]);

        // One open report per thing is enough; a second one would only fill the queue.
        $alreadyReported = Report::where('reporter_id', $user->id)
            ->where('conversation_id', $conversation->id)
            ->where('message_id', $message?->id)
            ->where('status', 'open')
            ->exists();

        if ($alreadyReported) {
            return back()->with('success', 'You have already reported this. An admin will look at it.');
        }

        $report = Report::create([
            'reporter_id' => $user->id,
            'reported_user_id' => $reportedUserId,
            'conversation_id' => $conversation->id,
            'message_id' => $message?->id,
            'reason' => $data['reason'],
            'details' => $data['details'] ?? null,
        ]);

        // Everyone who can review it, except the people it is about.
        $admins = User::where('role', 'admin')
            ->whereNull('suspended_at')
            ->whereNotIn('id', [$user->id, $reportedUserId])
            ->get();

        Notification::send($admins, new NewReport($report));

        return back()->with('success', 'Thanks, your report was sent to the admins.');
    }
}

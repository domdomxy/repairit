<?php

namespace App\Http\Controllers;

use App\Events\InboxUpdated;
use App\Events\MessageDeleted;
use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Models\Conversation;
use App\Models\ConversationState;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Offer;
use App\Models\User;
use App\Notifications\NewMessage;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MessageController extends Controller
{
    public function store(Request $request, Conversation $conversation)
    {
        $user = Auth::user();
        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        // A suspended account can't be written to (they can't read it either),
        // and the sender shouldn't get a silent success.
        abort_if($conversation->participantFor($user)->isSuspended(), 403, 'This account has been suspended.');

        $validated = $request->validate([
            // Text is optional when files are attached, and the other way round.
            'body' => ['nullable', 'string', 'max:5000', 'required_without:attachments'],
            'attachments' => [
                'nullable',
                'array',
                'max:'.Message::ATTACHMENT_MAX_FILES,
                // Keeps one message from carrying an enormous upload.
                function (string $attribute, mixed $value, Closure $fail) {
                    $bytes = collect($value)
                        ->filter(fn ($file) => $file instanceof UploadedFile)
                        ->sum(fn (UploadedFile $file) => $file->getSize());

                    if ($bytes > Message::ATTACHMENT_MAX_TOTAL_KB * 1024) {
                        $fail('The files together may not be larger than '.(Message::ATTACHMENT_MAX_TOTAL_KB / 1024).' MB.');
                    }
                },
            ],
            'attachments.*' => [
                'file',
                'max:'.Message::ATTACHMENT_MAX_KB,
                // Checked against the file's real content type, not just its name.
                'mimes:'.implode(',', Message::ATTACHMENT_EXTENSIONS),
            ],
        ], [
            'body.required_without' => 'Write a message or attach a file.',
            'attachments.max' => 'You can attach up to '.Message::ATTACHMENT_MAX_FILES.' files to one message.',
            'attachments.*.uploaded' => 'A file could not be uploaded. It may be too large.',
            'attachments.*.max' => 'Each file may not be larger than '.(Message::ATTACHMENT_MAX_KB / 1024).' MB.',
            'attachments.*.mimes' => 'That file type is not allowed.',
        ]);

        // Is this the customer's first message, in a conversation nobody has
        // written in yet? Checked before anything is stored, and against every
        // row (deleted ones included), so deleting a message or the whole
        // conversation can't earn a second auto-reply, and a technician who
        // wrote first doesn't answer themselves with a canned message.
        $isCustomersFirstMessage = $user->id === $conversation->customer_id
            && ! $conversation->messages()->exists();

        // Everything is stored before the rows are written, and removed again
        // if writing fails, so a failed send never leaves files behind. Text
        // and each file become their own message (like a real chat app: pick a
        // photo and a document together and they arrive as two bubbles, not one
        // bubble carrying both), so the transaction can return several rows.
        $stored = [];

        try {
            $messages = DB::transaction(function () use ($request, $conversation, $user, $validated, &$stored) {
                $messages = [];

                if (filled($validated['body'] ?? null)) {
                    $messages[] = $conversation->messages()->create([
                        'sender_id' => $user->id,
                        'body' => $validated['body'],
                    ]);
                }

                foreach ($request->file('attachments', []) as $file) {
                    $path = $file->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK);

                    abort_if($path === false, 500, 'A file could not be saved.');

                    $stored[] = $path;

                    $name = $file->getClientOriginalName();

                    $attachmentMessage = $conversation->messages()->create([
                        'sender_id' => $user->id,
                        'body' => null,
                    ]);

                    $attachmentMessage->attachments()->create([
                        'path' => $path,
                        // Keep the end of an over-long name so the extension survives.
                        'name' => mb_strlen($name) > 200 ? mb_substr($name, -200) : $name,
                        'mime' => $file->getMimeType() ?: 'application/octet-stream',
                        'size' => $file->getSize(),
                    ]);

                    $messages[] = $attachmentMessage;
                }

                return $messages;
            });
        } catch (Throwable $e) {
            Storage::disk(Message::ATTACHMENT_DISK)->delete($stored);

            throw $e;
        }

        $this->deliver($conversation, $user, $messages, $isCustomersFirstMessage);

        return back();
    }

    /**
     * Send an offer in the chat with its technician: the offer arrives as a
     * card the technician can open. Starts the conversation if there is none
     * yet, then takes the sender to it.
     */
    public function shareOffer(Request $request, Offer $offer): RedirectResponse
    {
        $validated = $request->validate([
            'message' => ['nullable', 'string', 'max:5000'],
        ]);

        $technician = $offer->technician;

        abort_unless($technician->role === 'technician' && ! $technician->isSuspended(), 404);

        $customer = Auth::user();
        abort_if($customer->id === $technician->id, 403, 'You cannot send your own offer to yourself.');

        $conversation = Conversation::firstOrCreate([
            'customer_id' => $customer->id,
            'technician_id' => $technician->id,
        ]);

        // Checked before the message exists, like a written first message.
        $isCustomersFirstMessage = ! $conversation->messages()->exists();

        $message = $conversation->messages()->create([
            'sender_id' => $customer->id,
            'offer_id' => $offer->id,
            'offer_title' => $offer->title,
            // Optional note that travels with the offer card.
            'body' => filled($validated['message'] ?? null) ? trim($validated['message']) : null,
        ]);

        $this->deliver($conversation, $customer, [$message], $isCustomersFirstMessage);

        return redirect()->route('conversations.show', $conversation);
    }

    /**
     * Everything that follows once a person's messages are stored: the
     * conversation moves up, comes back from "hidden" for the sender, the other
     * person is told (live, in their messages panel, and by email), and the
     * technician's automatic reply goes out if this was the customer's first
     * message.
     *
     * @param  array<int, Message>  $messages  Just created, oldest first.
     */
    private function deliver(Conversation $conversation, User $sender, array $messages, bool $isCustomersFirstMessage): void
    {
        foreach ($messages as $message) {
            $message->load('attachments', 'offer.media');
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

        if (! $alreadyNotified) {
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

    /**
     * Change the text of a message. Only the sender can, and only while it has
     * not been deleted for everyone. The text it had before is kept, so an edit
     * can't be used to rewrite what was really sent once a chat is reported.
     */
    public function update(Request $request, Message $message): RedirectResponse
    {
        $user = Auth::user();
        $conversation = $message->conversation;

        abort_unless($conversation->hasParticipant($user), 403);
        abort_unless($message->sender_id === $user->id, 403, 'You can only edit your own messages.');
        abort_if($message->isDeletedForEveryone(), 403, 'This message was deleted.');
        abort_if($message->offer_title !== null, 403, 'A shared offer cannot be edited.');

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
        ]);

        $body = $validated['body'] ?? null;

        // A message must keep something to show: text, or the files it carries.
        if ($body === null && ! $message->attachments()->exists()) {
            throw ValidationException::withMessages([
                'body' => 'A message needs some text. To remove it, delete it instead.',
            ]);
        }

        if ($body === $message->body) {
            return back();
        }

        DB::transaction(function () use ($message, $body) {
            $message->edits()->create(['body' => $message->body]);

            $message->forceFill(['body' => $body, 'edited_at' => now()])->save();
        });

        broadcast(new MessageUpdated($message))->toOthers();
        broadcast(new InboxUpdated($conversation->participantFor($user)->id));

        return back();
    }

    /**
     * Delete a message, either for the person asking only ("me") or for both
     * people ("everyone", the sender's right alone).
     *
     * Neither removes anything from the database or the disk: that is what lets
     * an admin read the whole conversation, deleted messages included, when it
     * is reported. The people in the conversation just stop seeing it.
     */
    public function destroy(Request $request, Message $message): RedirectResponse
    {
        $user = Auth::user();
        $conversation = $message->conversation;

        abort_unless($conversation->hasParticipant($user), 403);

        $scope = $request->validate([
            'scope' => ['required', Rule::in(['me', 'everyone'])],
        ])['scope'];

        // Can't act on what this person can no longer see (already deleted for
        // them, or from before they deleted the conversation).
        abort_unless(Message::whereKey($message->id)->visibleTo($user)->exists(), 404);

        if ($scope === 'me') {
            $message->deletions()->firstOrCreate(['user_id' => $user->id]);

            return back();
        }

        abort_unless($message->sender_id === $user->id, 403, 'Only the sender can delete a message for everyone.');

        if ($message->isDeletedForEveryone()) {
            return back();
        }

        $message->forceFill(['deleted_for_everyone_at' => now()])->save();

        broadcast(new MessageDeleted($message))->toOthers();
        broadcast(new InboxUpdated($conversation->participantFor($user)->id));

        return back();
    }

    /**
     * Stream an attachment to the two people in its conversation.
     *
     * Files live on the private disk, so this is the only way to reach them.
     * Images and PDFs are shown inline, so they can open in the app's own
     * viewer; every other type is forced to download so an uploaded page or
     * script can never run in the site's origin.
     *
     * Files of a message that was deleted (for everyone, or for this person) are
     * gone for the participants. An admin can still open them, but only for a
     * conversation that has been reported.
     */
    public function attachment(MessageAttachment $attachment): StreamedResponse
    {
        $user = Auth::user();
        $message = $attachment->message;
        $conversation = $message->conversation;

        $participant = $conversation->hasParticipant($user);
        $auditing = ! $participant && $user->isAdmin() && $conversation->reports()->exists();

        abort_unless($participant || $auditing, 403);

        if ($participant) {
            abort_unless(
                Message::whereKey($message->id)->whereNull('deleted_for_everyone_at')->visibleTo($user)->exists(),
                404,
            );
        }

        $disk = Storage::disk(Message::ATTACHMENT_DISK);
        abort_unless($disk->exists($attachment->path), 404);

        $inline = $attachment->isInlineImage() || $attachment->is_pdf;

        return $disk->response(
            $attachment->path,
            $attachment->name,
            array_filter([
                'Content-Type' => $inline ? $attachment->mime : null,
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, max-age=86400',
            ]),
            $inline ? 'inline' : 'attachment',
        );
    }
}

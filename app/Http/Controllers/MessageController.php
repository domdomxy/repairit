<?php

namespace App\Http\Controllers;

use App\Events\InboxUpdated;
use App\Events\MessageDeleted;
use App\Events\MessageUpdated;
use App\Http\Controllers\Concerns\DeliversMessages;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Offer;
use App\Models\ServiceRequest;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class MessageController extends Controller
{
    use DeliversMessages;

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
        // Files chosen in the same submission still get one shared `batch_id`,
        // so the chat can show them stacked together even though each keeps
        // its own row (and so its own delete/report).
        $stored = [];
        $files = $request->file('attachments', []);
        $batchId = count($files) > 1 ? (string) Str::uuid() : null;

        try {
            $messages = DB::transaction(function () use ($files, $conversation, $user, $validated, $batchId, &$stored) {
                $messages = [];

                if (filled($validated['body'] ?? null)) {
                    $messages[] = $conversation->messages()->create([
                        'sender_id' => $user->id,
                        'body' => $validated['body'],
                    ]);
                }

                foreach ($files as $file) {
                    $path = $file->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK);

                    abort_if($path === false, 500, 'A file could not be saved.');

                    $stored[] = $path;

                    $name = $file->getClientOriginalName();

                    $attachmentMessage = $conversation->messages()->create([
                        'sender_id' => $user->id,
                        'batch_id' => $batchId,
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
     * Share the sender's current location in the chat: it arrives as a small
     * map card the other person can open in their own maps app. The browser
     * is what actually reads the device's location; this just stores the
     * coordinates it already found and delivers them like any other message.
     */
    public function storeLocation(Request $request, Conversation $conversation): RedirectResponse
    {
        $user = Auth::user();
        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        abort_if($conversation->participantFor($user)->isSuspended(), 403, 'This account has been suspended.');

        $validated = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lng' => ['required', 'numeric', 'between:-180,180'],
            'label' => ['nullable', 'string', 'max:120'],
        ]);

        $isCustomersFirstMessage = $user->id === $conversation->customer_id
            && ! $conversation->messages()->exists();

        $message = $conversation->messages()->create([
            'sender_id' => $user->id,
            'location_lat' => $validated['lat'],
            'location_lng' => $validated['lng'],
            'location_label' => $validated['label'] ?? null,
        ]);

        $this->deliver($conversation, $user, [$message], $isCustomersFirstMessage);

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
     * Send a repair request in the chat with the customer who posted it: the
     * request arrives as a card they can open, with an optional note. Only
     * technicians can (it is how they answer a request); starts the
     * conversation if there is none yet, then takes the sender to it.
     */
    public function shareRequest(Request $request, ServiceRequest $serviceRequest): RedirectResponse
    {
        $validated = $request->validate([
            'message' => ['nullable', 'string', 'max:5000'],
        ]);

        $technician = Auth::user();

        abort_unless(
            $technician->role === 'technician' && $technician->technicianProfile !== null,
            403,
            'Only technicians can send a request in the chat.'
        );

        $customer = $serviceRequest->customer;

        abort_if($customer->isSuspended(), 404);
        abort_if($customer->id === $technician->id, 403, 'You cannot send your own request to yourself.');

        $conversation = Conversation::firstOrCreate([
            'customer_id' => $customer->id,
            'technician_id' => $technician->id,
        ]);

        $message = $conversation->messages()->create([
            'sender_id' => $technician->id,
            'service_request_id' => $serviceRequest->id,
            'request_excerpt' => $serviceRequest->excerpt(120),
            // Optional note that travels with the request card.
            'body' => filled($validated['message'] ?? null) ? trim($validated['message']) : null,
        ]);

        // The customer did not write, so this is never their first message.
        $this->deliver($conversation, $technician, [$message], false);

        return redirect()->route('conversations.show', $conversation);
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
        // A shared request is a card, and a quote is changed from its own card.
        abort_if($message->request_excerpt !== null, 403, 'A shared request or quote cannot be edited here.');
        abort_if($message->location_lat !== null, 403, 'A shared location cannot be edited.');
        abort_if($message->attachments()->exists(), 403, 'A message with attachments cannot be edited.');

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:5000'],
        ]);

        $body = $validated['body'] ?? null;

        // Only text messages get here, so an emptied one has nothing left to show.
        if ($body === null) {
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

        $inline = $attachment->isInlineImage() || $attachment->isInlineVideo() || $attachment->is_pdf;

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

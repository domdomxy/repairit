<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Notifications\NewMessage;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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

        // Everything is stored before the rows are written, and removed again
        // if writing fails, so a failed send never leaves files behind.
        $stored = [];

        try {
            $message = DB::transaction(function () use ($request, $conversation, $user, $validated, &$stored) {
                $message = $conversation->messages()->create([
                    'sender_id' => $user->id,
                    'body' => $validated['body'] ?? null,
                ]);

                foreach ($request->file('attachments', []) as $file) {
                    $path = $file->store("message-attachments/{$conversation->id}", Message::ATTACHMENT_DISK);

                    abort_if($path === false, 500, 'A file could not be saved.');

                    $stored[] = $path;

                    $name = $file->getClientOriginalName();

                    $message->attachments()->create([
                        'path' => $path,
                        // Keep the end of an over-long name so the extension survives.
                        'name' => mb_strlen($name) > 200 ? mb_substr($name, -200) : $name,
                        'mime' => $file->getMimeType() ?: 'application/octet-stream',
                        'size' => $file->getSize(),
                    ]);
                }

                return $message;
            });
        } catch (Throwable $e) {
            Storage::disk(Message::ATTACHMENT_DISK)->delete($stored);

            throw $e;
        }

        $message->load('attachments');

        $conversation->update(['last_message_at' => $message->created_at]);

        broadcast(new MessageSent($message))->toOthers();

        // Tell the recipient once per unread stretch rather than for every line
        // of a back-and-forth: if they already have an unread message from this
        // sender, they have been told.
        $alreadyNotified = $conversation->messages()
            ->whereNull('read_at')
            ->where('sender_id', $user->id)
            ->where('id', '<', $message->id)
            ->exists();

        if (! $alreadyNotified) {
            $conversation->participantFor($user)->notify(new NewMessage($message));
        }

        return back();
    }

    /**
     * Stream an attachment to the two people in its conversation.
     *
     * Files live on the private disk, so this is the only way to reach them.
     * Plain images are shown inline; every other type is forced to download
     * so an uploaded page or script can never run in the site's origin.
     */
    public function attachment(MessageAttachment $attachment): StreamedResponse
    {
        $user = Auth::user();
        $conversation = $attachment->message->conversation;

        abort_unless(
            $user->id === $conversation->customer_id || $user->id === $conversation->technician_id,
            403
        );

        $disk = Storage::disk(Message::ATTACHMENT_DISK);
        abort_unless($disk->exists($attachment->path), 404);

        $inline = $attachment->isInlineImage();

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

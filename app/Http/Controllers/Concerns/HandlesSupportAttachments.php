<?php

namespace App\Http\Controllers\Concerns;

use App\Models\SupportMessage;
use App\Models\SupportMessageAttachment;
use App\Models\SupportTicket;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pictures on support tickets. Only the person asking for help can add them
 * (signed in or as a guest); staff can read them but never attach any, so the
 * admin controller does not use the upload half of this.
 */
trait HandlesSupportAttachments
{
    /** Rules to merge into a request that may carry pictures. */
    protected function attachmentRules(): array
    {
        return [
            'attachments' => [
                'nullable',
                'array',
                'max:'.SupportMessage::ATTACHMENT_MAX_FILES,
                function (string $attribute, mixed $value, \Closure $fail) {
                    $bytes = collect($value)
                        ->filter(fn ($file) => $file instanceof UploadedFile)
                        ->sum(fn (UploadedFile $file) => $file->getSize());

                    if ($bytes > SupportMessage::ATTACHMENT_MAX_TOTAL_KB * 1024) {
                        $fail('The pictures together may not be larger than '.(SupportMessage::ATTACHMENT_MAX_TOTAL_KB / 1024).' MB.');
                    }
                },
            ],
            'attachments.*' => [
                'file',
                'max:'.SupportMessage::ATTACHMENT_MAX_KB,
                'mimes:'.implode(',', SupportMessage::ATTACHMENT_EXTENSIONS),
            ],
        ];
    }

    protected function attachmentMessages(): array
    {
        return [
            'body.required_without' => 'Write a message or attach a picture.',
            'attachments.max' => 'You can attach up to '.SupportMessage::ATTACHMENT_MAX_FILES.' pictures to one message.',
            'attachments.*.uploaded' => 'A picture could not be uploaded. It may be too large.',
            'attachments.*.max' => 'Each picture may not be larger than '.(SupportMessage::ATTACHMENT_MAX_KB / 1024).' MB.',
            'attachments.*.mimes' => 'Only JPG, PNG, GIF or WebP pictures can be attached.',
            'attachments.*.file' => 'That is not a valid picture.',
        ];
    }

    /**
     * Save the pictures and write their rows. Every stored path is added to
     * `$stored`, so the caller can remove the files again if anything after
     * this fails: a failed send never leaves files behind.
     *
     * @param  array<int, UploadedFile>  $files
     * @param  array<int, string>  $stored
     */
    protected function storeAttachments(SupportMessage $message, array $files, array &$stored): void
    {
        foreach ($files as $file) {
            $mime = $file->getMimeType();

            abort_unless(in_array($mime, SupportMessage::ATTACHMENT_MIMES, true), 422, 'Only pictures can be attached.');

            $path = $file->store("support-attachments/{$message->support_ticket_id}", SupportMessage::ATTACHMENT_DISK);

            abort_if($path === false, 500, 'A picture could not be saved.');

            $stored[] = $path;

            $name = $file->getClientOriginalName();

            $message->attachments()->create([
                'path' => $path,
                // Keep the end of an over-long name so the extension survives.
                'name' => mb_strlen($name) > 200 ? mb_substr($name, -200) : $name,
                'mime' => $mime,
                'size' => $file->getSize(),
            ]);
        }
    }

    /** @param  array<int, string>  $stored */
    protected function deleteStored(array $stored): void
    {
        Storage::disk(SupportMessage::ATTACHMENT_DISK)->delete($stored);
    }

    /**
     * Stream one picture of a ticket. The caller has already decided this
     * person may read the ticket; here it only has to be one of its pictures.
     * Files are always sent with their own picture type and `nosniff`, and
     * anything else is forced to download, so an upload can never run as a page.
     */
    protected function streamAttachment(SupportTicket $ticket, SupportMessageAttachment $attachment): StreamedResponse
    {
        abort_unless($attachment->message?->support_ticket_id === $ticket->id, 404);

        $disk = Storage::disk(SupportMessage::ATTACHMENT_DISK);

        abort_unless($disk->exists($attachment->path), 404);

        $inline = $attachment->isInlineImage();

        return $disk->response(
            $attachment->path,
            $attachment->name,
            [
                'Content-Type' => $inline ? $attachment->mime : 'application/octet-stream',
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, max-age=86400',
            ],
            $inline ? 'inline' : 'attachment',
        );
    }
}

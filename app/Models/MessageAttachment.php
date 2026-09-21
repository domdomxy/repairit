<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageAttachment extends Model
{
    protected $fillable = [
        'message_id',
        'path',
        'name',
        'mime',
        'size',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    // The browser gets the name, size, whether to show it as a picture, and an
    // authorised URL. The storage path and the rest stay on the server.
    protected $hidden = [
        'message_id',
        'path',
        'mime',
        'created_at',
        'updated_at',
    ];

    protected $appends = ['is_image', 'is_video', 'is_pdf', 'url'];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function isInlineImage(): bool
    {
        return in_array($this->mime, Message::INLINE_IMAGE_MIMES, true);
    }

    public function isInlineVideo(): bool
    {
        return in_array($this->mime, Message::INLINE_VIDEO_MIMES, true);
    }

    /** Whether this attachment is media (a picture or a clip): what the chat can stack and preview. */
    public function isMedia(): bool
    {
        return $this->isInlineImage() || $this->isInlineVideo();
    }

    protected function getIsImageAttribute(): bool
    {
        return $this->isInlineImage();
    }

    protected function getIsVideoAttribute(): bool
    {
        return $this->isInlineVideo();
    }

    // PDFs are shown in an in-page viewer instead of a plain download link.
    protected function getIsPdfAttribute(): bool
    {
        return $this->mime === 'application/pdf';
    }

    protected function getUrlAttribute(): string
    {
        // Relative, so it works from whatever host the page was opened on.
        return route('messages.attachment', $this->id, absolute: false);
    }
}

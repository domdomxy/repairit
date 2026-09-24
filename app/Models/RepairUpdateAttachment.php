<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A file the technician attached to an update on a repair's timeline. */
class RepairUpdateAttachment extends Model
{
    protected $fillable = [
        'repair_update_id',
        'path',
        'name',
        'mime',
        'size',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    // Not `update()`: that is a method of every Eloquent model.
    public function repairUpdate(): BelongsTo
    {
        return $this->belongsTo(RepairUpdate::class);
    }

    public function isInlineImage(): bool
    {
        return in_array($this->mime, Message::INLINE_IMAGE_MIMES, true);
    }

    public function isInlineVideo(): bool
    {
        return in_array($this->mime, Message::INLINE_VIDEO_MIMES, true);
    }

    public function isPdf(): bool
    {
        return $this->mime === 'application/pdf';
    }

    /** Pictures, clips and PDFs open in the page; everything else is always downloaded. */
    public function isInline(): bool
    {
        return $this->isInlineImage() || $this->isInlineVideo() || $this->isPdf();
    }

    /**
     * What the browser gets: the name, the size, how to show it, and an
     * authorised URL. The storage path and the mime type stay on the server.
     *
     * @return array<string, mixed>
     */
    public function toTimelineEntry(Repair $repair): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'size' => $this->size,
            'is_image' => $this->isInlineImage(),
            'is_video' => $this->isInlineVideo(),
            'is_pdf' => $this->isPdf(),
            // Relative, so it works from whatever host the page was opened on.
            'url' => route('repairs.attachment', [$repair, $this->id], absolute: false),
        ];
    }
}

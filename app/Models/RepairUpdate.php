<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One entry of a repair's timeline: a status, and what the technician said about it. */
class RepairUpdate extends Model
{
    /** Files live on the private disk and are only reachable through the repair's own route. */
    public const ATTACHMENT_DISK = 'local';

    /** The same limits and file types as the chat, so there is one list to keep. */
    public const ATTACHMENT_MAX_KB = Message::ATTACHMENT_MAX_KB;

    public const ATTACHMENT_MAX_FILES = Message::ATTACHMENT_MAX_FILES;

    public const ATTACHMENT_MAX_TOTAL_KB = Message::ATTACHMENT_MAX_TOTAL_KB;

    public const ATTACHMENT_EXTENSIONS = Message::ATTACHMENT_EXTENSIONS;

    /** What the update form needs to check a file before sending it. */
    public static function attachmentLimits(): array
    {
        return [
            'max_files' => self::ATTACHMENT_MAX_FILES,
            'max_kb' => self::ATTACHMENT_MAX_KB,
            'max_total_kb' => self::ATTACHMENT_MAX_TOTAL_KB,
            'extensions' => self::ATTACHMENT_EXTENSIONS,
        ];
    }

    protected $fillable = [
        'repair_id',
        'status',
        'note',
    ];

    public function repair(): BelongsTo
    {
        return $this->belongsTo(Repair::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(RepairUpdateAttachment::class)->orderBy('id');
    }

    /** @return array<string, mixed> */
    public function toTimelineEntry(Repair $repair): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'status_label' => Repair::STATUSES[$this->status] ?? $this->status,
            'note' => $this->note,
            'attachments' => $this->attachments->map(fn (RepairUpdateAttachment $attachment) => $attachment->toTimelineEntry($repair))->all(),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

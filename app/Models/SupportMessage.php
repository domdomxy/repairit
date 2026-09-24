<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportMessage extends Model
{
    /** Pictures live on the private disk and are only reachable through the ticket's own routes. */
    public const ATTACHMENT_DISK = 'local';

    /** Largest single picture, in kilobytes. */
    public const ATTACHMENT_MAX_KB = 5120;

    public const ATTACHMENT_MAX_FILES = 5;

    /** Keeps one message from carrying an enormous upload. */
    public const ATTACHMENT_MAX_TOTAL_KB = 20480;

    /** Pictures only: no videos, documents or vector images (an SVG can carry script). */
    public const ATTACHMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    public const ATTACHMENT_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    /** What the upload forms need to check a picture before sending it. */
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
        'support_ticket_id',
        'user_id',
        'from_staff',
        'body',
        'is_automated',
    ];

    protected $casts = [
        'from_staff' => 'boolean',
        'is_automated' => 'boolean',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(SupportTicket::class, 'support_ticket_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SupportMessageAttachment::class)->orderBy('id');
    }
}

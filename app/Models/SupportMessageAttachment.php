<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A picture attached to a support message by the person asking for help. */
class SupportMessageAttachment extends Model
{
    protected $fillable = [
        'support_message_id',
        'path',
        'name',
        'mime',
        'size',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(SupportMessage::class, 'support_message_id');
    }

    /** Only the four picture types are ever stored, so this is a safety net when serving. */
    public function isInlineImage(): bool
    {
        return in_array($this->mime, SupportMessage::ATTACHMENT_MIMES, true);
    }
}

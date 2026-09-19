<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    /** Private disk (storage/app/private): files are only reachable through the authorised route. */
    public const ATTACHMENT_DISK = 'local';

    /** Largest single file, in kilobytes. Keep the total under PHP's upload_max_filesize / post_max_size. */
    public const ATTACHMENT_MAX_KB = 5120;

    /** Most files one message can carry. */
    public const ATTACHMENT_MAX_FILES = 5;

    /** Largest total for all the files of one message, in kilobytes. */
    public const ATTACHMENT_MAX_TOTAL_KB = 20480;

    /** File types users may attach. Add an extension here to allow another type. */
    public const ATTACHMENT_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'pdf', 'txt', 'csv',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip',
    ];

    /** Only these are shown inline; everything else is always downloaded. */
    public const INLINE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /** The files sent with this message, oldest first. Load them with `with('attachments')`. */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class)->orderBy('id');
    }
}

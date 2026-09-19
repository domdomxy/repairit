<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    /** Private disk (storage/app/private): files are only reachable through the authorised route. */
    public const ATTACHMENT_DISK = 'local';

    /** Largest attachment, in kilobytes. Keep it under PHP's upload_max_filesize / post_max_size. */
    public const ATTACHMENT_MAX_KB = 5120;

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
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'attachment_size' => 'integer',
    ];

    // The raw columns stay on the server; the browser gets the `attachment`
    // summary below instead (name, size, image or not, and an authorised URL).
    protected $hidden = [
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
    ];

    protected $appends = ['attachment'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function isInlineImage(): bool
    {
        return in_array($this->attachment_mime, self::INLINE_IMAGE_MIMES, true);
    }

    /**
     * @return Attribute<array{name: string|null, size: int|null, is_image: bool, url: string}|null, never>
     */
    protected function attachment(): Attribute
    {
        return Attribute::get(function () {
            if (! $this->attachment_path) {
                return null;
            }

            return [
                'name' => $this->attachment_name,
                'size' => $this->attachment_size,
                'is_image' => $this->isInlineImage(),
                // Relative, so it works from whatever host the page was opened on.
                'url' => route('messages.attachment', [$this->conversation_id, $this->id], absolute: false),
            ];
        });
    }
}

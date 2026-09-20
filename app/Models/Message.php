<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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
        'edited_at' => 'datetime',
        'deleted_for_everyone_at' => 'datetime',
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

    /** What the message said before each edit, oldest first. Only admins ever see these. */
    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class)->orderBy('id');
    }

    /** The people who used "Delete for me" on this message. */
    public function deletions(): HasMany
    {
        return $this->hasMany(MessageDeletion::class);
    }

    public function isDeletedForEveryone(): bool
    {
        return $this->deleted_for_everyone_at !== null;
    }

    /**
     * The messages a person can still see: not removed with "Delete for me",
     * and not from before they deleted the whole conversation.
     *
     * Messages deleted for everyone are still included: they show as a
     * placeholder, so use `forClient()` to present them.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('message_deletions')
                    ->whereColumn('message_deletions.message_id', 'messages.id')
                    ->where('message_deletions.user_id', $user->id);
            })
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('conversation_states')
                    ->whereColumn('conversation_states.conversation_id', 'messages.conversation_id')
                    ->where('conversation_states.user_id', $user->id)
                    ->whereNotNull('conversation_states.cleared_at')
                    ->whereColumn('conversation_states.cleared_through_message_id', '>=', 'messages.id');
            });
    }

    /**
     * The message as the two people in the conversation see it, on the page and
     * over the websocket. A message deleted for everyone keeps its place but
     * loses its text and files; `sender` must be loaded for `sender_name`, and
     * `attachments` for the files.
     *
     * @return array<string, mixed>
     */
    public function forClient(): array
    {
        $deleted = $this->isDeletedForEveryone();

        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'sender_name' => $this->relationLoaded('sender') ? $this->sender?->name : null,
            'body' => $deleted ? null : $this->body,
            'attachments' => $deleted ? [] : $this->attachments->toArray(),
            'created_at' => $this->created_at->toIso8601String(),
            'edited_at' => $deleted ? null : $this->edited_at?->toIso8601String(),
            'deleted' => $deleted,
        ];
    }
}

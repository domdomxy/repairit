<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user reporting a message or a whole conversation. Admins can read the full
 * conversation of a reported chat, including messages that were deleted.
 */
class Report extends Model
{
    /** Stored value => label shown to people. */
    public const REASONS = [
        'spam' => 'Spam or advertising',
        'harassment' => 'Harassment or abuse',
        'inappropriate' => 'Inappropriate content',
        'fraud' => 'Scam or fraud',
        'other' => 'Something else',
    ];

    public const STATUSES = ['open', 'resolved', 'dismissed'];

    protected $fillable = [
        'reporter_id',
        'reported_user_id',
        'conversation_id',
        'message_id',
        'reason',
        'details',
        'status',
        'resolution_note',
        'reviewed_by_id',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    protected $attributes = [
        'status' => 'open',
    ];

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
    }

    public function reportedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_user_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }

    public function isMessageReport(): bool
    {
        return $this->message_id !== null;
    }

    public function reasonLabel(): string
    {
        return self::REASONS[$this->reason] ?? 'Something else';
    }
}

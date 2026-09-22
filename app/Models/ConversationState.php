<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** What one of the two people has done to a conversation: hidden it, pinned it, or deleted it for themselves. */
class ConversationState extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'hidden_at',
        'pinned_at',
        'cleared_at',
        'cleared_through_message_id',
    ];

    protected $casts = [
        'hidden_at' => 'datetime',
        'pinned_at' => 'datetime',
        'cleared_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

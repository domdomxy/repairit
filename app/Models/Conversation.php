<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = [
        'customer_id',
        'technician_id',
        'last_message_at',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasMany
    {
        return $this->messages()->latest()->limit(1);
    }

    /** Each person's own hide/delete state for this conversation. */
    public function states(): HasMany
    {
        return $this->hasMany(ConversationState::class);
    }

    public function reports(): HasMany
    {
        return $this->hasMany(Report::class);
    }

    public function hasParticipant(User $user): bool
    {
        return $user->id === $this->customer_id || $user->id === $this->technician_id;
    }

    /** Change one person's hide/delete state, creating it the first time. */
    public function updateStateFor(User $user, array $attributes): ConversationState
    {
        return $this->states()->updateOrCreate(['user_id' => $user->id], $attributes);
    }

    // Helper: the "other" participant relative to a given user
    public function participantFor(User $user): User
    {
        return $user->id === $this->customer_id ? $this->technician : $this->customer;
    }
}
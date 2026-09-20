<?php

namespace App\Models;

use App\Observers\ReviewObserver;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[ObservedBy(ReviewObserver::class)]
class Review extends Model
{
    protected $fillable = [
        'technician_id',
        'customer_id',
        'conversation_id',
        'rating',
        'comment',
    ];

    protected $casts = [
        'rating' => 'integer',
    ];

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * The conversation that entitles a customer to review a technician.
     *
     * Both sides must have written in it, so a review always follows a real
     * exchange rather than a customer merely opening a thread. Returns null
     * when the customer isn't allowed to review yet.
     */
    public static function conversationFor(User $customer, User $technician): ?Conversation
    {
        return Conversation::query()
            ->where('customer_id', $customer->id)
            ->where('technician_id', $technician->id)
            ->whereHas('messages', fn ($query) => $query->where('sender_id', $customer->id))
            // An automatic reply doesn't count: the technician has to have actually answered.
            ->whereHas('messages', fn ($query) => $query
                ->where('sender_id', $technician->id)
                ->where('is_automated', false))
            ->first();
    }
}

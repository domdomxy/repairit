<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A technician's rating of a customer. `technician_id` is who wrote it,
 * `customer_id` is who it is about (the mirror of {@see Review}).
 */
class CustomerReview extends Model
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

    /** The technician who wrote the review. */
    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    /** The customer the review is about. */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * The conversation that entitles a technician to rate a customer: the same
     * one that lets the customer review the technician (both sides have really
     * written in it). Null when the technician isn't allowed to rate yet.
     */
    public static function conversationFor(User $technician, User $customer): ?Conversation
    {
        return Review::conversationFor($customer, $technician);
    }
}

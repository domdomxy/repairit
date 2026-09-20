<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user reporting a message, a whole conversation, an offer or a review.
 * Admins can read the full conversation of a reported chat, including messages
 * that were deleted. An offer or review report has no conversation.
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
        'offer_id',
        'offer_title',
        'review_id',
        'customer_review_id',
        'review_kind',
        'review_subject_id',
        'review_rating',
        'review_comment',
        'reason',
        'details',
        'status',
        'resolution_note',
        'reviewed_by_id',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'review_rating' => 'integer',
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

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by_id');
    }

    /** The reported review, when a customer's review of a technician: gone once it is deleted. */
    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class);
    }

    /** The reported review, when a technician's review of a customer: gone once it is deleted. */
    public function customerReview(): BelongsTo
    {
        return $this->belongsTo(CustomerReview::class);
    }

    /** Who the reported review was about (the reported user is the one who wrote it). */
    public function reviewSubject(): BelongsTo
    {
        return $this->belongsTo(User::class, 'review_subject_id');
    }

    public function isMessageReport(): bool
    {
        return $this->message_id !== null;
    }

    /** A review report keeps its own copy of the review, so it stays one after the review is deleted. */
    public function isReviewReport(): bool
    {
        return $this->review_kind !== null;
    }

    /** Offer reports have no conversation (the offer itself may be gone by now); nor do review reports, which are told apart first. */
    public function isOfferReport(): bool
    {
        return $this->conversation_id === null && ! $this->isReviewReport();
    }

    /** What was reported: 'review', 'offer', 'message' or 'conversation'. */
    public function type(): string
    {
        return match (true) {
            $this->isReviewReport() => 'review',
            $this->isOfferReport() => 'offer',
            $this->isMessageReport() => 'message',
            default => 'conversation',
        };
    }

    /** The same, as it reads in a sentence. */
    public function targetLabel(): string
    {
        return match ($this->type()) {
            'review' => 'a review',
            'offer' => 'an offer',
            'message' => 'a message',
            default => 'a conversation',
        };
    }

    public function reasonLabel(): string
    {
        return self::REASONS[$this->reason] ?? 'Something else';
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A user reporting a message, a whole conversation, an offer, a repair request,
 * a review or a person as a whole. Admins can read the full conversation of a
 * reported chat, including messages that were deleted. An offer, request,
 * review or person report has no conversation.
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

    /** What the person who filed a report sees for each status (the admins' words are Report::STATUSES). */
    public const REPORTER_STATUS_LABELS = [
        'open' => 'Under review',
        'resolved' => 'Resolved',
        'dismissed' => 'Closed',
    ];

    protected $fillable = [
        'reporter_id',
        'reported_user_id',
        'conversation_id',
        'message_id',
        'offer_id',
        'offer_title',
        'service_request_id',
        'request_excerpt',
        'review_id',
        'customer_review_id',
        'review_kind',
        'review_subject_id',
        'review_rating',
        'review_comment',
        'user_report',
        'reason',
        'details',
        'reporter_ack_text',
        'reporter_closure_text',
        'status',
        'resolution_note',
        'reviewed_by_id',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'review_rating' => 'integer',
        'user_report' => 'boolean',
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

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
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

    /** A request report keeps the start of what the request said, so it stays one after the request is deleted. */
    public function isRequestReport(): bool
    {
        return $this->conversation_id === null && $this->request_excerpt !== null;
    }

    /** A person reported as a whole: the report points at no message, post or review, only at the reported user. */
    public function isUserReport(): bool
    {
        return $this->user_report;
    }

    /** Offer reports have no conversation (the offer itself may be gone by now); nor do review, request and user reports, which are told apart first. */
    public function isOfferReport(): bool
    {
        return $this->conversation_id === null
            && ! $this->isReviewReport()
            && ! $this->isRequestReport()
            && ! $this->isUserReport();
    }

    /** What was reported: 'user', 'review', 'request', 'offer', 'message' or 'conversation'. */
    public function type(): string
    {
        return match (true) {
            $this->isUserReport() => 'user',
            $this->isReviewReport() => 'review',
            $this->isRequestReport() => 'request',
            $this->isOfferReport() => 'offer',
            $this->isMessageReport() => 'message',
            default => 'conversation',
        };
    }

    /** The same, as it reads in a sentence. */
    public function targetLabel(): string
    {
        return match ($this->type()) {
            'user' => 'a user',
            'review' => 'a review',
            'request' => 'a request',
            'offer' => 'an offer',
            'message' => 'a message',
            default => 'a conversation',
        };
    }

    public function reasonLabel(): string
    {
        return self::REASONS[$this->reason] ?? 'Something else';
    }

    /**
     * What the person who filed the report sees in their list and on the page of the
     * report. The reported person is only named: nothing of what was decided about
     * them, and none of the admin's notes, is here.
     *
     * @return array<string, mixed>
     */
    public function toReporterItem(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'status_label' => self::REPORTER_STATUS_LABELS[$this->status] ?? $this->status,
            'type' => $this->type(),
            'target_label' => $this->targetLabel(),
            'reason_label' => $this->reasonLabel(),
            'about' => $this->reportedUser?->name,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }

    /**
     * The steps of a report for its reporter, oldest first: it was sent (with the
     * acknowledgement they were given), it is being looked at, and, once an admin
     * has closed it, that it is over (with the closing message they were given).
     * A report an admin reopened goes back to "being looked at".
     *
     * @return list<array{key: string, title: string, at: ?string, text: ?string, state: string}>
     */
    public function reporterTimeline(): array
    {
        $closed = $this->status !== 'open';

        return [
            [
                'key' => 'sent',
                'title' => 'Report sent to our team',
                'at' => $this->created_at->toIso8601String(),
                'text' => $this->reporter_ack_text,
                'state' => 'done',
            ],
            [
                'key' => 'review',
                'title' => $closed ? 'Reviewed by our team' : 'Being reviewed by our team',
                'at' => null,
                'text' => null,
                'state' => $closed ? 'done' : 'current',
            ],
            [
                'key' => 'closed',
                'title' => match ($this->status) {
                    'resolved' => 'Resolved',
                    'dismissed' => 'Closed without action',
                    default => 'We will let you know when we are done',
                },
                'at' => $closed ? $this->reviewed_at?->toIso8601String() : null,
                'text' => $closed ? $this->reporter_closure_text : null,
                'state' => $closed ? 'done' : 'upcoming',
            ],
        ];
    }
}

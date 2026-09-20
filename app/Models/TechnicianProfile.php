<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TechnicianProfile extends Model
{
    /** Longest custom auto-reply, in characters. */
    public const AUTO_REPLY_MAX_LENGTH = 1000;

    /** What is sent when the auto-reply is on and the technician hasn't written their own. {name} is the customer's first name. */
    public const DEFAULT_AUTO_REPLY = "Hi {name}, thanks for reaching out! I've received your message and will get back to you as soon as I can.";

    protected $fillable = [
        'user_id',
        'bio',
        'address',
        'city',
        'latitude',
        'longitude',
        'availability_status',
        'phone',
        'show_phone_publicly',
        'show_email_publicly',
        'auto_reply_enabled',
        'auto_reply_message',
        'rating_avg',
        'rating_count',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'show_phone_publicly' => 'boolean',
        'show_email_publicly' => 'boolean',
        'auto_reply_enabled' => 'boolean',
        'rating_avg' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_technician');
    }

    /**
     * The text of the automatic first reply to a customer: the technician's own
     * message if they wrote one, the default otherwise. "{name}" in either
     * becomes the customer's first name.
     */
    public function autoReplyFor(User $customer): string
    {
        $template = filled($this->auto_reply_message)
            ? $this->auto_reply_message
            : self::DEFAULT_AUTO_REPLY;

        $firstName = trim(strtok(trim($customer->name), ' ') ?: '');

        return trim(str_replace('{name}', $firstName, $template));
    }

    /**
     * Recompute the cached rating from this technician's reviews.
     */
    public function refreshRatings(): void
    {
        $stats = Review::where('technician_id', $this->user_id)
            ->selectRaw('COUNT(*) as total, AVG(rating) as average')
            ->first();

        $this->update([
            'rating_count' => (int) $stats->total,
            'rating_avg' => round((float) $stats->average, 2),
        ]);
    }
}
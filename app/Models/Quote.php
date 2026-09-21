<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A technician's answer to a {@see ServiceRequest}: price, how long it would
 * take, and a note. Only the customer who asked and the technician who wrote
 * it can see it.
 */
class Quote extends Model
{
    public const PRICE_MAX = 60;

    public const TIME_MAX = 60;

    public const MESSAGE_MAX = 1000;

    protected $fillable = [
        'technician_id',
        'price',
        'estimated_time',
        'message',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
    ];

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    /** The chat messages that carry this quote. */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    /** What the quote says, on one line: kept for the admins when a quote is changed or withdrawn. */
    public function summary(): string
    {
        return 'Quote: '.$this->price
            .(filled($this->estimated_time) ? ' · takes about '.$this->estimated_time : '')
            .(filled($this->message) ? ' — '.$this->message : '');
    }

    /**
     * The limits the quote form needs.
     *
     * @return array<string, int>
     */
    public static function limits(): array
    {
        return [
            'price_max' => self::PRICE_MAX,
            'time_max' => self::TIME_MAX,
            'message_max' => self::MESSAGE_MAX,
        ];
    }

    public function isAccepted(): bool
    {
        return $this->accepted_at !== null;
    }

    /**
     * The quote as the browser gets it, with the technician's public card:
     * name, picture, city and rating, never their email, phone or address.
     * Load `technician.technicianProfile` first.
     *
     * @return array<string, mixed>
     */
    public function toClient(): array
    {
        $profile = $this->technician->technicianProfile;

        return [
            'id' => $this->id,
            'price' => $this->price,
            'estimated_time' => $this->estimated_time,
            'message' => $this->message,
            'accepted' => $this->isAccepted(),
            'created_at' => $this->created_at?->toIso8601String(),
            'technician' => [
                'id' => $this->technician->id,
                'name' => $this->technician->name,
                'avatar_url' => $this->technician->avatar_url,
                'city' => $profile?->city,
                'rating_avg' => $profile?->rating_avg,
                'rating_count' => (int) ($profile?->rating_count ?? 0),
            ],
        ];
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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

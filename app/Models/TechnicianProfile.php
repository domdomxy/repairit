<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class TechnicianProfile extends Model
{
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
        'rating_avg',
        'rating_count',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'show_phone_publicly' => 'boolean',
        'show_email_publicly' => 'boolean',
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
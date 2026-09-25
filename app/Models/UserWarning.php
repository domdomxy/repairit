<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One warning an admin gave a user, ahead of suspending them. It counts
 * toward the account's health status for 90 days from when it was issued,
 * then ages out on its own — see User::healthStatus().
 */
class UserWarning extends Model
{
    protected $fillable = ['user_id', 'admin_id', 'reason', 'expires_at'];

    /** How long a warning counts toward the account's health status. */
    public const LIFESPAN_DAYS = 90;

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The admin who issued it, or null if that admin's account was since deleted. */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    /** Warnings still counted toward the account's health status. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('expires_at', '>', now());
    }

    /** Warnings that have aged out and no longer count. */
    public function scopeExpired(Builder $query): Builder
    {
        return $query->where('expires_at', '<=', now());
    }

    public function isActive(): bool
    {
        return $this->expires_at->isFuture();
    }
}

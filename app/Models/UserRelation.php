<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One person's stance towards another: they blocked, muted, favorited or
 * restricted them. One-way, and never shown to the person it is about.
 *
 *  - block:    neither can write to the other or answer each other's requests,
 *              and they vanish from each other's search, feed and profile pages.
 *  - mute:     their messages, quotes and reviews still arrive, without any
 *              notification, email or unread badge.
 *  - favorite: pinned in the inbox and easy to find again in the technician search.
 *  - restrict: their messages wait in "Requests" without a notification, and
 *              no automatic reply goes out to them.
 */
class UserRelation extends Model
{
    public const BLOCK = 'block';

    public const MUTE = 'mute';

    public const FAVORITE = 'favorite';

    public const RESTRICT = 'restrict';

    public const TYPES = [self::BLOCK, self::MUTE, self::FAVORITE, self::RESTRICT];

    protected $fillable = ['user_id', 'target_id', 'type'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_id');
    }

    /**
     * Everyone this person can no longer see, or be seen by: the people they
     * blocked and the people who blocked them.
     *
     * @return list<int>
     */
    public static function blockedIdsFor(User $user): array
    {
        $blocked = static::where('type', self::BLOCK)
            ->where('user_id', $user->id)
            ->pluck('target_id');

        $blockedBy = static::where('type', self::BLOCK)
            ->where('target_id', $user->id)
            ->pluck('user_id');

        return $blocked->merge($blockedBy)->unique()->values()->all();
    }
}

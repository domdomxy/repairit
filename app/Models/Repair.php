<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Something a customer left with a technician (a phone to repair, a parcel to
 * deliver) whose progress the technician keeps up to date. The customer follows
 * it from a link built on the tracking code, and does not need to ask.
 */
class Repair extends Model
{
    /** Stored value => label shown to people. */
    public const STATUSES = [
        'received' => 'Received',
        'diagnosing' => 'Diagnosing',
        'waiting' => 'On hold',
        'in_progress' => 'In progress',
        'ready' => 'Ready for pickup',
        'completed' => 'Completed',
        'cancelled' => 'Cancelled',
    ];

    /** The usual road from drop-off to hand-back. "On hold" and "cancelled" sit beside it. */
    public const FLOW = ['received', 'diagnosing', 'in_progress', 'ready', 'completed'];

    /** Statuses of repairs that are over. */
    public const CLOSED_STATUSES = ['completed', 'cancelled'];

    protected $fillable = [
        'code',
        'technician_id',
        'customer_id',
        'title',
        'description',
        'status',
    ];

    // Matches the column default, so a freshly created model behaves like a reloaded one.
    protected $attributes = [
        'status' => 'received',
    ];

    /** The tracking link is /repairs/{code}: the code, not the row number, so links can't be guessed by counting. */
    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public function technician(): BelongsTo
    {
        return $this->belongsTo(User::class, 'technician_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** The timeline, newest first. */
    /**
     * The repairs whose title or code contain the words typed in a search box, or
     * whose other person (`customer` for a technician's list, `technician` for a
     * customer's) has that in their name.
     *
     * @param  Builder<Repair>  $query
     */
    public function scopeSearch(Builder $query, string $term, string $person): void
    {
        $query->where(fn (Builder $query) => $query
            ->where('title', 'like', "%{$term}%")
            ->orWhere('code', 'like', "%{$term}%")
            ->orWhereHas($person, fn (Builder $query) => $query->where('name', 'like', "%{$term}%")));
    }

    public function updates(): HasMany
    {
        return $this->hasMany(RepairUpdate::class)->orderByDesc('created_at')->orderByDesc('id');
    }

    public function isClosed(): bool
    {
        return in_array($this->status, self::CLOSED_STATUSES, true);
    }

    public function statusLabel(): string
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }

    /**
     * A reference people can read out or type: ambiguous characters (0/O, 1/I)
     * are left out of the alphabet. Anyone who has the code can open
     * the page, so it is long enough not to be guessed.
     */
    public static function generateCode(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

        do {
            $code = 'REP-';

            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (static::where('code', $code)->exists());

        return $code;
    }

    /**
     * The customers a technician can link a repair to: the ones who have a
     * conversation with them, since that is where customers and technicians meet.
     *
     * @return list<array{id: int, name: string}>
     */
    public static function customerChoices(User $technician): array
    {
        return User::query()
            ->whereIn('id', $technician->technicianConversations()->select('customer_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $customer) => ['id' => $customer->id, 'name' => $customer->name])
            ->all();
    }

    /**
     * What a list of repairs shows about each one.
     *
     * @return array<string, mixed>
     */
    public function toListItem(): array
    {
        return [
            'code' => $this->code,
            'title' => $this->title,
            'status' => $this->status,
            'status_label' => $this->statusLabel(),
            'created_at' => $this->created_at->toIso8601String(),
            'updated_at' => $this->updated_at->toIso8601String(),
        ];
    }
}

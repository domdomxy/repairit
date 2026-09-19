<?php

namespace App\Models;

use App\Notifications\NewSupportTicket;
use App\Notifications\SupportReply;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class SupportTicket extends Model
{
    public const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

    /** Statuses that count as "still needs handling", used for the per-user limit and the admin badge. */
    public const ACTIVE_STATUSES = ['open', 'in_progress'];

    /** A user can have this many active tickets at once, so the queue can't be flooded. */
    public const MAX_ACTIVE_PER_USER = 5;

    /** Stored value => label shown to people. */
    public const CATEGORIES = [
        'question' => 'General question',
        'account' => 'My account',
        'report' => 'Report a user',
        'bug' => 'Something is broken',
        'other' => 'Other',
    ];

    protected $fillable = [
        'tracking_id',
        'user_id',
        'category',
        'subject',
        'status',
        'last_activity_at',
        'closed_at',
    ];

    protected $casts = [
        'last_activity_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportMessage::class);
    }

    public function isClosed(): bool
    {
        return $this->status === 'closed';
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? 'Other';
    }

    /** Move to a new status and keep closed_at and the activity time consistent. */
    public function transitionTo(string $status): void
    {
        $this->status = $status;
        $this->closed_at = $status === 'closed' ? now() : null;
        $this->last_activity_at = now();
        $this->save();
    }

    /**
     * A reference people can read out or type: ambiguous characters (0/O, 1/I)
     * are left out of the alphabet.
     */
    public static function generateTrackingId(): string
    {
        $alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

        do {
            $id = 'SUP-';

            for ($i = 0; $i < 6; $i++) {
                $id .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (static::where('tracking_id', $id)->exists());

        return $id;
    }

    /**
     * The conversation as the given person should see it. Support staff appear
     * as "Support team" to the customer, so an admin's name is not exposed.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function threadFor(User $viewer): Collection
    {
        return $this->messages()
            ->with('author:id,name')
            ->orderBy('id')
            ->get()
            ->map(fn (SupportMessage $message) => [
                'id' => $message->id,
                'body' => $message->body,
                'from_staff' => $message->from_staff,
                'author' => $message->from_staff && ! $viewer->isAdmin()
                    ? 'Support team'
                    : ($message->author?->name ?? 'Deleted user'),
                'created_at' => $message->created_at->toIso8601String(),
            ]);
    }

    /** Opening a ticket is what "reads" its notifications, so the bell stays honest. */
    public function markNotificationsReadFor(User $user): void
    {
        $user->unreadNotifications()
            ->whereIn('type', [NewSupportTicket::class, SupportReply::class, SupportTicketStatusChanged::class])
            ->get()
            ->filter(fn ($notification) => ($notification->data['ticket_id'] ?? null) === $this->id)
            ->each->markAsRead();
    }
}

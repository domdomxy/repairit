<?php

namespace App\Models;

use App\Notifications\NewSupportTicket;
use App\Notifications\SupportReply;
use App\Notifications\SupportTicketStatusChanged;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class SupportTicket extends Model
{
    public const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

    /** Statuses that count as "still needs handling", used for the per-user limit and the admin badge. */
    public const ACTIVE_STATUSES = ['open', 'in_progress'];

    /** Moving into one of these sends the owner the admin-managed closure message. */
    public const CLOSURE_STATUSES = ['resolved', 'closed'];

    /** A ticket waiting on its owner with no activity for this long is closed automatically. */
    public const INACTIVE_CLOSE_AFTER_HOURS = 24;

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
        'guest_name',
        'guest_email',
        'guest_token',
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

    /** No account behind this ticket — just a name and an email left at the door. */
    public function isGuest(): bool
    {
        return $this->user_id === null;
    }

    public function ownerName(): string
    {
        return $this->user?->name ?? $this->guest_name ?? 'Guest';
    }

    public function ownerEmail(): ?string
    {
        return $this->user?->email ?? $this->guest_email;
    }

    public function categoryLabel(): string
    {
        return self::CATEGORIES[$this->category] ?? 'Other';
    }

    /**
     * Move to a new status and keep closed_at and the activity time consistent.
     * Actually changing to resolved or closed also posts the automatic closure
     * message (unless an admin turned it off); staying put, like a reply on an
     * already resolved ticket, never does.
     */
    public function transitionTo(string $status, ?string $closureKey = null): void
    {
        $previous = $this->status;

        $this->status = $status;
        $this->closed_at = $status === 'closed' ? now() : null;
        $this->last_activity_at = now();
        $this->save();

        if ($previous !== $status && in_array($status, self::CLOSURE_STATUSES, true)) {
            $this->postClosureMessage($closureKey ?? $status);
        }
    }

    /**
     * Tickets that have gone quiet for a day and are not waiting on staff:
     * resolved ones, and ones where staff answered last. An open ticket the
     * owner wrote last is left alone, so a slow support team never closes
     * someone's ticket on them.
     */
    public function scopeInactive($query)
    {
        return $query
            ->whereIn('status', ['in_progress', 'resolved'])
            ->where('last_activity_at', '<=', now()->subHours(self::INACTIVE_CLOSE_AFTER_HOURS))
            ->where(fn ($query) => $query
                ->where('status', 'resolved')
                ->orWhereRaw('(select from_staff from support_messages where support_messages.support_ticket_id = support_tickets.id and is_automated = 0 order by id desc limit 1) = 1'));
    }

    /**
     * The canned "this ticket is resolved/closed" note, written as the support
     * team and flagged automated, so it shows up in the thread like the first
     * automatic reply does and never counts as staff actually answering.
     */
    private function postClosureMessage(string $key): void
    {
        $body = AutoResponse::textFor(AutoResponse::TYPE_SUPPORT_CLOSURE, $key);

        if ($body === null) {
            return;
        }

        $this->messages()->create([
            'user_id' => null,
            'from_staff' => true,
            'is_automated' => true,
            'body' => $body,
        ]);
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
     * A guest's key to their own ticket, since they have no account to sign
     * into. Long and random enough that it isn't worth guessing.
     */
    public static function generateGuestToken(): string
    {
        do {
            $token = Str::random(48);
        } while (static::where('guest_token', $token)->exists());

        return $token;
    }

    /**
     * The conversation as the given person should see it. Support staff appear
     * as "Support team" to the customer, so an admin's name is not exposed.
     * A null viewer is a guest reading their own ticket — never staff.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function threadFor(?User $viewer): Collection
    {
        return $this->messages()
            ->with('author:id,name,avatar_path', 'attachments')
            ->orderBy('id')
            ->get()
            ->map(function (SupportMessage $message) use ($viewer) {
                $anonymous = $message->from_staff && ! $viewer?->isAdmin();

                return [
                    'id' => $message->id,
                    'body' => $message->body,
                    'from_staff' => $message->from_staff,
                    'automated' => $message->is_automated,
                    'attachments' => $message->attachments
                        ->map(fn (SupportMessageAttachment $attachment) => $this->attachmentPayload($attachment, $viewer))
                        ->values()
                        ->all(),
                    // A guest's own messages have no user_id at all (there was never
                    // an account), so they fall back to their name, not "Deleted user".
                    'author' => $anonymous
                        ? 'Support team'
                        : ($message->author?->name ?? ($message->from_staff ? 'Deleted user' : $this->ownerName())),
                    // The picture goes the same way as the name: hidden when staff are anonymous.
                    'avatar_url' => $anonymous ? null : $message->author?->avatar_url,
                    'created_at' => $message->created_at->toIso8601String(),
                ];
            });
    }

    /**
     * A picture as the browser gets it: name, size and a URL through the route
     * that fits who is looking (a guest's link carries the ticket's token).
     * The flags match what the shared image viewer expects.
     *
     * @return array<string, mixed>
     */
    private function attachmentPayload(SupportMessageAttachment $attachment, ?User $viewer): array
    {
        $url = match (true) {
            $viewer === null => route('support.guest.attachment', [
                'ticket' => $this->id,
                'token' => $this->guest_token,
                'attachment' => $attachment->id,
            ], absolute: false),
            $viewer->isAdmin() => route('admin.support.attachment', [
                'ticket' => $this->id,
                'attachment' => $attachment->id,
            ], absolute: false),
            default => route('support.attachment', [
                'ticket' => $this->id,
                'attachment' => $attachment->id,
            ], absolute: false),
        };

        return [
            'id' => $attachment->id,
            'name' => $attachment->name,
            'size' => $attachment->size,
            'url' => $url,
            'is_image' => true,
            'is_video' => false,
            'is_pdf' => false,
        ];
    }

    /**
     * Mark what the other side wrote as read, for whoever has just opened the
     * ticket: staff read what the person asking for help wrote, and that
     * person (signed in or a guest) reads what staff wrote. Returns the id of
     * the oldest message that was still unread, which is where the page puts
     * its "New messages" line, or null when nothing was.
     */
    public function markReadBy(bool $staff): ?int
    {
        $unread = $this->messages()
            ->where('from_staff', ! $staff)
            ->whereNull('read_at')
            ->orderBy('id')
            ->pluck('id');

        if ($unread->isNotEmpty()) {
            $this->messages()->whereIn('id', $unread)->update(['read_at' => now()]);
        }

        return $unread->first();
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

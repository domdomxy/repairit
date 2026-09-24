<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['name', 'email', 'password', 'role', 'email_notifications', 'bio', 'city', 'phone', 'show_phone_publicly', 'show_email_publicly', 'links', 'trusted_link_hosts'])]
// trusted_link_hosts is private to its owner: it reaches the browser only through
// the shared `auth.trusted_hosts` prop, never inside a user shown to someone else.
#[Hidden(['password', 'remember_token', 'avatar_path', 'phone', 'trusted_link_hosts'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** Private disk (storage/app/private): pictures are only reachable through the authorised route. */
    public const AVATAR_DISK = 'local';

    /** Largest profile picture, in kilobytes. The browser shrinks pictures before upload, so this is generous. */
    public const AVATAR_MAX_KB = 2048;

    /** Picture types users may upload. Animated and vector formats are left out on purpose. */
    public const AVATAR_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

    protected static function booted(): void
    {
        // The database cascade removes a deleted account's conversations and
        // messages but knows nothing about the files on disk, so delete those.
        static::deleting(function (User $user) {
            if ($user->avatar_path) {
                Storage::disk(self::AVATAR_DISK)->delete($user->avatar_path);
            }

            // Offers and their media rows go with the cascade; the files don't.
            Storage::disk(Offer::MEDIA_DISK)->deleteDirectory("offer-media/{$user->id}");

            Conversation::where('customer_id', $user->id)
                ->orWhere('technician_id', $user->id)
                ->pluck('id')
                ->each(fn ($id) => Storage::disk(Message::ATTACHMENT_DISK)->deleteDirectory("message-attachments/{$id}"));

            // Their support tickets and the pictures on them go with the cascade; the files don't.
            SupportTicket::where('user_id', $user->id)
                ->pluck('id')
                ->each(fn ($id) => Storage::disk(SupportMessage::ATTACHMENT_DISK)->deleteDirectory("support-attachments/{$id}"));
        });
    }

    // Matches the column default, so a freshly created model behaves like a
    // reloaded one.
    protected $attributes = [
        'email_notifications' => true,
    ];

    // The stored path stays on the server; the browser gets `avatar_url`.
    // Anywhere a user is loaded with a column list, include `avatar_path`
    // or the picture is treated as missing.
    protected $appends = ['avatar_url'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'email_notifications' => 'boolean',
            'show_phone_publicly' => 'boolean',
            'show_email_publicly' => 'boolean',
            'links' => 'array',
            'trusted_link_hosts' => 'array',
            'password' => 'hashed',
        ];
    }

    /**
     * Where the browser can load this person's picture, or null if they have none.
     *
     * The `v` value changes with every new upload, so browsers that cached the
     * old picture fetch the new one straight away.
     */
    protected function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar_path) {
            return null;
        }

        return route('avatars.show', ['user' => $this->id, 'v' => substr(md5($this->avatar_path), 0, 8)], absolute: false);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    /** What this person did about other people (blocked, muted, favorited, restricted them). */
    public function relationsGiven(): HasMany
    {
        return $this->hasMany(UserRelation::class, 'user_id');
    }

    /** Whether this person has applied `$type` (see UserRelation::TYPES) to `$other`. */
    public function hasRelation(string $type, User|int $other): bool
    {
        return UserRelation::where('user_id', $this->id)
            ->where('target_id', $other instanceof User ? $other->id : $other)
            ->where('type', $type)
            ->exists();
    }

    /** All four at once, as the pages need them. */
    public function relationFlagsFor(User $other): array
    {
        $types = UserRelation::where('user_id', $this->id)
            ->where('target_id', $other->id)
            ->pluck('type');

        return [
            'blocked' => $types->contains(UserRelation::BLOCK),
            'muted' => $types->contains(UserRelation::MUTE),
            'favorited' => $types->contains(UserRelation::FAVORITE),
            'restricted' => $types->contains(UserRelation::RESTRICT),
        ];
    }

    public function hasBlocked(User $other): bool
    {
        return $this->hasRelation(UserRelation::BLOCK, $other);
    }

    /** Either of them blocked the other: they cannot reach each other. */
    public function isBlockedWith(User $other): bool
    {
        return $this->hasBlocked($other) || $other->hasBlocked($this);
    }

    /**
     * Whether what `$sender` does should reach this person quietly: they muted
     * or restricted the sender (or blocked them, or were blocked by them).
     */
    public function silences(User $sender): bool
    {
        return UserRelation::where('user_id', $this->id)
            ->where('target_id', $sender->id)
            ->whereIn('type', [UserRelation::MUTE, UserRelation::RESTRICT, UserRelation::BLOCK])
            ->exists()
            || $sender->hasBlocked($this);
    }

    /** Notify this person about something `$sender` did, unless they have silenced the sender. */
    public function notifyFrom(User $sender, Notification $notification): void
    {
        if (! $this->silences($sender)) {
            $this->notify($notification);
        }
    }

    public function supportTickets(): HasMany
    {
        return $this->hasMany(SupportTicket::class);
    }

    public function customerConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'customer_id');
    }

    public function technicianConversations(): HasMany
    {
        return $this->hasMany(Conversation::class, 'technician_id');
    }
    public function technicianProfile(): HasOne
    {
        return $this->hasOne(TechnicianProfile::class);
    }

    public function reviewsReceived(): HasMany
    {
        return $this->hasMany(Review::class, 'technician_id');
    }

    /** What technicians wrote about a customer. */
    public function customerReviewsReceived(): HasMany
    {
        return $this->hasMany(CustomerReview::class, 'customer_id');
    }

    /** The repair requests this person has posted. */
    public function serviceRequests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class, 'customer_id');
    }

    /** The quotes a technician has sent to other people's repair requests. */
    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'technician_id');
    }

    /** The offers a technician shows on their profile. */
    public function offers(): HasMany
    {
        return $this->hasMany(Offer::class, 'technician_id');
    }

    /** The repairs a technician is keeping track of for their customers. */
    public function technicianRepairs(): HasMany
    {
        return $this->hasMany(Repair::class, 'technician_id');
    }

    /** The repairs a customer follows: the ones a technician linked to their account. */
    public function customerRepairs(): HasMany
    {
        return $this->hasMany(Repair::class, 'customer_id');
    }
}

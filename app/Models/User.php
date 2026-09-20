<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['name', 'email', 'password', 'role', 'email_notifications'])]
#[Hidden(['password', 'remember_token', 'avatar_path'])]
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

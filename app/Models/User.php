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
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected static function booted(): void
    {
        // The database cascade removes a deleted account's conversations and
        // messages but knows nothing about the files on disk, so delete those.
        static::deleting(function (User $user) {
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
}

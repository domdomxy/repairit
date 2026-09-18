<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminLog extends Model
{
    protected $fillable = [
        'admin_id',
        'action',
        'description',
        'target_type',
        'target_id',
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    /**
     * Record something an admin did.
     *
     * The description is a human-readable snapshot (names, emails) because the
     * target may be deleted later, which would leave target_id pointing at
     * nothing.
     */
    public static function record(User $admin, string $action, string $description, ?Model $target = null): self
    {
        return static::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'description' => $description,
            'target_type' => $target ? class_basename($target) : null,
            'target_id' => $target?->getKey(),
        ]);
    }
}

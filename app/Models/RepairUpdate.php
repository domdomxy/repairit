<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One entry of a repair's timeline: a status, and what the technician said about it. */
class RepairUpdate extends Model
{
    protected $fillable = [
        'repair_id',
        'status',
        'note',
    ];

    public function repair(): BelongsTo
    {
        return $this->belongsTo(Repair::class);
    }

    /** @return array<string, mixed> */
    public function toTimelineEntry(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'status_label' => Repair::STATUSES[$this->status] ?? $this->status,
            'note' => $this->note,
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}

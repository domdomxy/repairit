<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** The text a message had before one edit. Created_at is the moment it was replaced. */
class MessageEdit extends Model
{
    protected $fillable = ['message_id', 'body'];

    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }
}

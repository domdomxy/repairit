<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferMedia extends Model
{
    protected $table = 'offer_media';

    protected $fillable = [
        'offer_id',
        'path',
        'name',
        'mime',
        'size',
    ];

    protected $casts = [
        'size' => 'integer',
    ];

    // The browser gets the name, size, whether it is a picture or a video, and
    // an authorised URL. The storage path and the rest stay on the server.
    protected $hidden = [
        'offer_id',
        'path',
        'mime',
        'created_at',
        'updated_at',
    ];

    protected $appends = ['type', 'url'];

    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    /** "image" or "video". */
    protected function getTypeAttribute(): string
    {
        return (Offer::MEDIA_MIMES[$this->mime] ?? 'image') === 'video' ? 'video' : 'image';
    }

    protected function getUrlAttribute(): string
    {
        // Relative, so it works from whatever host the page was opened on.
        return route('offers.media', $this->id, absolute: false);
    }
}

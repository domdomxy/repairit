<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A picture or video attached to a repair request. Same kinds of file, limits
 * and private storage as an offer's ({@see OfferMedia}).
 */
class RequestMedia extends Model
{
    protected $table = 'request_media';

    protected $fillable = [
        'service_request_id',
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
        'service_request_id',
        'path',
        'mime',
        'created_at',
        'updated_at',
    ];

    protected $appends = ['type', 'url'];

    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    /** "image" or "video". */
    protected function getTypeAttribute(): string
    {
        return (Offer::MEDIA_MIMES[$this->mime] ?? 'image') === 'video' ? 'video' : 'image';
    }

    protected function getUrlAttribute(): string
    {
        // Relative, so it works from whatever host the page was opened on.
        return route('requests.media', $this->id, absolute: false);
    }
}

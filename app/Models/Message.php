<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Message extends Model
{
    /** Private disk (storage/app/private): files are only reachable through the authorised route. */
    public const ATTACHMENT_DISK = 'local';

    /** Largest single file, in kilobytes. Keep the total under PHP's upload_max_filesize / post_max_size. */
    public const ATTACHMENT_MAX_KB = 5120;

    /** Most files one message can carry. */
    public const ATTACHMENT_MAX_FILES = 5;

    /** Largest total for all the files of one message, in kilobytes. */
    public const ATTACHMENT_MAX_TOTAL_KB = 20480;

    /** File types users may attach. Add an extension here to allow another type. */
    public const ATTACHMENT_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'pdf', 'txt', 'csv',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'zip',
    ];

    /** Only these are shown inline; everything else is always downloaded. */
    public const INLINE_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'offer_id',
        'offer_title',
        'service_request_id',
        'request_excerpt',
        'quote_id',
        'quote_price',
        'read_at',
        'is_automated',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'is_automated' => 'boolean',
        'edited_at' => 'datetime',
        'deleted_for_everyone_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /** The offer this message shares, if any (gone once the technician deletes it). Load it with `with('offer.media')`. */
    public function offer(): BelongsTo
    {
        return $this->belongsTo(Offer::class);
    }

    /** The repair request this message shares or answers, if any (gone once the customer deletes it). Load it with `with('serviceRequest.media')`. */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class);
    }

    /** The quote this message carries, if any (gone once the technician deletes it). */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    /** The files sent with this message, oldest first. Load them with `with('attachments')`. */
    public function attachments(): HasMany
    {
        return $this->hasMany(MessageAttachment::class)->orderBy('id');
    }

    /** What the message said before each edit, oldest first. Only admins ever see these. */
    public function edits(): HasMany
    {
        return $this->hasMany(MessageEdit::class)->orderBy('id');
    }

    /** The people who used "Delete for me" on this message. */
    public function deletions(): HasMany
    {
        return $this->hasMany(MessageDeletion::class);
    }

    public function isDeletedForEveryone(): bool
    {
        return $this->deleted_for_everyone_at !== null;
    }

    /**
     * The messages a person can still see: not removed with "Delete for me",
     * and not from before they deleted the whole conversation.
     *
     * Messages deleted for everyone are still included: they show as a
     * placeholder, so use `forClient()` to present them.
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('message_deletions')
                    ->whereColumn('message_deletions.message_id', 'messages.id')
                    ->where('message_deletions.user_id', $user->id);
            })
            ->whereNotExists(function ($sub) use ($user) {
                $sub->selectRaw('1')
                    ->from('conversation_states')
                    ->whereColumn('conversation_states.conversation_id', 'messages.conversation_id')
                    ->where('conversation_states.user_id', $user->id)
                    ->whereNotNull('conversation_states.cleared_at')
                    ->whereColumn('conversation_states.cleared_through_message_id', '>=', 'messages.id');
            });
    }

    /**
     * The message as the two people in the conversation see it, on the page and
     * over the websocket. A message deleted for everyone keeps its place but
     * loses its text and files; `sender` must be loaded for `sender_name`, and
     * `attachments` for the files.
     *
     * @return array<string, mixed>
     */
    public function forClient(): array
    {
        $deleted = $this->isDeletedForEveryone();

        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'sender_name' => $this->relationLoaded('sender') ? $this->sender?->name : null,
            'body' => $deleted ? null : $this->body,
            'attachments' => $deleted ? [] : $this->attachments->toArray(),
            'offer' => $deleted ? null : $this->sharedOffer(),
            'request' => $deleted ? null : $this->sharedRequest(),
            'quote' => $deleted ? null : $this->sharedQuote(),
            'created_at' => $this->created_at->toIso8601String(),
            'edited_at' => $deleted ? null : $this->edited_at?->toIso8601String(),
            'deleted' => $deleted,
            'automated' => (bool) $this->is_automated,
        ];
    }

    /**
     * The offer this message shares, as the small card the chat shows: null for
     * an ordinary message. When the offer has been deleted since, only its title
     * is left, and the card says it is no longer available.
     *
     * @return array<string, mixed>|null
     */
    public function sharedOffer(): ?array
    {
        if ($this->offer_title === null) {
            return null;
        }

        $offer = $this->offer_id ? $this->offer : null;

        if ($offer === null) {
            return ['id' => null, 'title' => $this->offer_title, 'price' => null, 'image_url' => null, 'url' => null];
        }

        return [
            'id' => $offer->id,
            'title' => $offer->title,
            'price' => $offer->price,
            'image_url' => $offer->media->first(fn (OfferMedia $media) => $media->type === 'image')?->url,
            'url' => route('offers.show', $offer->id, absolute: false),
        ];
    }

    /**
     * The repair request this message shares, as the small card the chat shows:
     * null for an ordinary message (and for a quote, which has its own card).
     * When the request has been deleted since, only the start of its text is
     * left, and the card says it is no longer available.
     *
     * @return array<string, mixed>|null
     */
    public function sharedRequest(): ?array
    {
        if ($this->request_excerpt === null || $this->quote_price !== null) {
            return null;
        }

        $request = $this->service_request_id ? $this->serviceRequest : null;

        if ($request === null) {
            return [
                'id' => null,
                'excerpt' => $this->request_excerpt,
                'budget' => null,
                'city' => null,
                'status' => null,
                'image_url' => null,
                'url' => null,
            ];
        }

        return [
            'id' => $request->id,
            'excerpt' => $request->excerpt(120),
            'budget' => $request->budget,
            'city' => $request->city,
            'status' => $request->status,
            'image_url' => $request->media->first(fn (RequestMedia $media) => $media->type === 'image')?->url,
            'url' => route('requests.show', $request->id, absolute: false),
        ];
    }

    /**
     * The quote this message carries, as the card the chat shows: null for any
     * other message. It follows the quote (a technician who edits it changes the
     * card for both people, and the message is marked as edited). Once the quote
     * is deleted, only the price it had is left and `id` is null.
     *
     * @return array<string, mixed>|null
     */
    public function sharedQuote(): ?array
    {
        if ($this->quote_price === null) {
            return null;
        }

        $request = $this->request_excerpt === null ? null : [
            'id' => $this->service_request_id,
            'excerpt' => $this->request_excerpt,
            'url' => $this->service_request_id ? route('requests.show', $this->service_request_id, absolute: false) : null,
        ];

        $quote = $this->quote_id ? $this->quote : null;

        if ($quote === null) {
            return [
                'id' => null,
                'price' => $this->quote_price,
                'estimated_time' => null,
                'message' => null,
                'accepted' => false,
                'edited' => false,
                'request' => $request,
            ];
        }

        return [
            'id' => $quote->id,
            'price' => $quote->price,
            'estimated_time' => $quote->estimated_time,
            'message' => $quote->message,
            'accepted' => $quote->isAccepted(),
            'edited' => $this->edited_at !== null,
            'request' => $request,
        ];
    }
}

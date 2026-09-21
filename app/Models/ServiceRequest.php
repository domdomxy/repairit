<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A repair request: something a customer needs fixed, described for
 * technicians to answer with a {@see Quote}. Anyone signed in can see an open
 * request; the quotes are private to the customer and the technician who
 * wrote each one.
 */
class ServiceRequest extends Model
{
    /** Most open requests one person can have at a time. */
    public const MAX_OPEN_PER_CUSTOMER = 10;

    public const TITLE_MAX = 120;

    public const DESCRIPTION_MAX = 2000;

    public const BUDGET_MAX = 60;

    public const CITY_MAX = 100;

    /** Most categories a request can be tagged with. */
    public const MAX_CATEGORIES = 5;

    public const STATUS_OPEN = 'open';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'title',
        'description',
        'budget',
        'city',
        'status',
    ];

    protected $attributes = [
        'status' => self::STATUS_OPEN,
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** The categories the customer tagged this request with, by name. Load them with `with('categories')`. */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'category_service_request')->orderBy('categories.name');
    }

    /** The pictures and videos of this request, oldest first. Load them with `with('media')`. */
    public function media(): HasMany
    {
        return $this->hasMany(RequestMedia::class)->orderBy('id');
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::STATUS_OPEN;
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('service_requests.status', self::STATUS_OPEN);
    }

    /** Requests of people who can still sign in: a suspended person's requests are not shown. */
    public function scopeFromActiveCustomers(Builder $query): Builder
    {
        return $query->whereHas('customer', fn (Builder $customer) => $customer->whereNull('suspended_at'));
    }

    /**
     * The card sent to the browser: the request and who posted it, public
     * fields only (never the email). Load `customer`, `categories` and `media` first,
     * and count `quotes` for the number shown on the card.
     *
     * @return array<string, mixed>
     */
    public function toCard(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'budget' => $this->budget,
            'city' => $this->city,
            'status' => $this->status,
            'created_at' => $this->created_at?->toIso8601String(),
            'quotes_count' => (int) ($this->quotes_count ?? 0),
            'media' => $this->media->values()->all(),
            'categories' => $this->categories
                ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug])
                ->values()
                ->all(),
            'customer' => [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'avatar_url' => $this->customer->avatar_url,
                'role' => $this->customer->role,
            ],
        ];
    }
}

<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Offer;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The page where every technician's offers are browsed and filtered.
 *
 * A technician's own list (with the forms to add and edit) is a different
 * page: see TechnicianOfferController.
 */
class OfferController extends Controller
{
    private const PER_PAGE = 12;

    /** How many technicians the "top rated" side list shows. */
    private const TOP_RATED_LIMIT = 5;

    private const SORTS = ['newest', 'oldest', 'rating'];

    /** "images" and "videos" are matched on the content type checked at upload. */
    private const MEDIA_FILTERS = ['any', 'image', 'video'];

    public function index(Request $request): Response
    {
        // Same shape as the technician search: the profile table is joined once,
        // so every filter and the sort share a single reference to it. The inner
        // join also drops offers of technicians who have no profile, and offers
        // of suspended technicians never show up.
        $query = Offer::query()
            ->join('users', 'users.id', '=', 'offers.technician_id')
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->whereNull('users.suspended_at')
            ->select('offers.*')
            ->with(['media', 'categories', 'technician.technicianProfile']);

        // Free text: matches the title, the description or the technician's name.
        $term = trim((string) $request->input('q'));

        if ($term !== '') {
            $like = $this->likePattern($term);

            $query->where(function ($q) use ($like) {
                $q->whereRaw("offers.title LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("offers.description LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("users.name LIKE ? ESCAPE '!'", [$like]);
            });
        }

        // The categories the technician tagged the offer with.
        if ($request->filled('category')) {
            $slug = (string) $request->input('category');

            $query->whereExists(function ($q) use ($slug) {
                $q->selectRaw('1')
                    ->from('category_offer')
                    ->join('categories', 'categories.id', '=', 'category_offer.category_id')
                    ->whereColumn('category_offer.offer_id', 'offers.id')
                    ->where('categories.slug', $slug);
            });
        }

        if ($request->filled('availability')) {
            $query->where('technician_profiles.availability_status', $request->input('availability'));
        }

        if ($request->filled('city')) {
            $query->whereRaw("technician_profiles.city LIKE ? ESCAPE '!'", [$this->likePattern((string) $request->input('city'))]);
        }

        // Only offers that come with pictures and/or videos.
        $media = $request->input('media');

        if (in_array($media, self::MEDIA_FILTERS, true)) {
            $query->whereExists(function ($q) use ($media) {
                $q->selectRaw('1')
                    ->from('offer_media')
                    ->whereColumn('offer_media.offer_id', 'offers.id');

                if ($media !== 'any') {
                    $q->where('offer_media.mime', 'like', $media.'/%');
                }
            });
        }

        match ($request->input('sort')) {
            'oldest' => $query->orderBy('offers.created_at')->orderBy('offers.id'),
            'rating' => $query->orderByDesc('technician_profiles.rating_avg')
                ->orderByDesc('technician_profiles.rating_count')
                ->orderByDesc('offers.id'),
            default => $query->orderByDesc('offers.created_at')->orderByDesc('offers.id'),
        };

        // through() keeps the paginator shape (data + links) the page expects,
        // but swaps every model for its public card.
        $offers = $query->paginate(self::PER_PAGE)
            ->withQueryString()
            ->through(fn (Offer $offer) => $this->card($offer));

        return Inertia::render('Offers/Index', [
            'offers' => $offers,
            'categories' => Category::orderBy('name')->get(),
            'topRated' => $this->topRated((string) $request->input('top_category')),
            'reportReasons' => Report::REASONS,
            // Cast to an object: an empty PHP array reaches the browser as a JS
            // array, where `filters.sort` is Array.prototype.sort, not "unset".
            'filters' => (object) $request->only(['q', 'category', 'city', 'availability', 'media', 'sort', 'top_category']),
        ]);
    }

    /**
     * The best rated technicians, for the side list: best average first, more
     * reviews winning a tie. Technicians nobody has reviewed yet are not
     * "top rated", and suspended ones are left out. Public fields only.
     *
     * An optional category slug narrows the ranking down to technicians who
     * have at least one offer tagged with it, independent of the main offers
     * list's own category filter above.
     *
     * @return list<array<string, mixed>>
     */
    private function topRated(string $categorySlug = ''): array
    {
        $query = User::query()
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->whereNull('users.suspended_at')
            ->where('technician_profiles.rating_count', '>', 0)
            ->select('users.*')
            ->with('technicianProfile');

        if ($categorySlug !== '') {
            $query->whereExists(function ($q) use ($categorySlug) {
                $q->selectRaw('1')
                    ->from('offers')
                    ->join('category_offer', 'category_offer.offer_id', '=', 'offers.id')
                    ->join('categories', 'categories.id', '=', 'category_offer.category_id')
                    ->whereColumn('offers.technician_id', 'users.id')
                    ->where('categories.slug', $categorySlug);
            });
        }

        return $query
            ->orderByDesc('technician_profiles.rating_avg')
            ->orderByDesc('technician_profiles.rating_count')
            ->orderBy('users.id')
            ->limit(self::TOP_RATED_LIMIT)
            ->get()
            ->map(fn (User $technician) => [
                'id' => $technician->id,
                'name' => $technician->name,
                'avatar_url' => $technician->avatar_url,
                'city' => $technician->technicianProfile->city,
                'availability_status' => $technician->technicianProfile->availability_status,
                'rating_avg' => $technician->technicianProfile->rating_avg,
                'rating_count' => (int) $technician->technicianProfile->rating_count,
            ])
            ->all();
    }

    /** One offer on its own page, for sharing by link. */
    public function show(Offer $offer): Response
    {
        $offer->load(['media', 'categories', 'technician.technicianProfile']);

        $technician = $offer->technician;

        abort_unless(
            $technician->role === 'technician' && ! $technician->isSuspended() && $technician->technicianProfile,
            404,
        );

        return Inertia::render('Offers/Show', [
            'offer' => $this->card($offer),
            'reportReasons' => Report::REASONS,
        ]);
    }

    /**
     * An offer plus the public card of the technician behind it.
     *
     * Technicians are never sent to the browser as raw models: that would ship
     * their email, phone, street address and exact coordinates to every
     * signed-in user, whatever their "show publicly" toggles say. Only the
     * fields listed here leave the server.
     *
     * @return array<string, mixed>
     */
    private function card(Offer $offer): array
    {
        $technician = $offer->technician;
        $profile = $technician->technicianProfile;

        return $offer->toCard() + [
            'created_at' => $offer->created_at?->toIso8601String(),
            'technician' => [
                'id' => $technician->id,
                'name' => $technician->name,
                'avatar_url' => $technician->avatar_url,
                'city' => $profile->city,
                'availability_status' => $profile->availability_status,
                'rating_avg' => $profile->rating_avg,
                'rating_count' => $profile->rating_count,
            ],
        ];
    }

    /**
     * A partial, case-insensitive LIKE pattern for what the person typed. The
     * term is escaped so %, _ and the escape character itself match literally.
     * "!" is the escape character because, unlike backslash, ESCAPE '!' means
     * the same on MySQL and SQLite.
     */
    private function likePattern(string $term): string
    {
        $term = mb_substr(trim($term), 0, 100);

        return '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
    }
}

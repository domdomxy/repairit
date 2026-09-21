<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Offer;
use App\Models\ServiceRequest;
use App\Models\User;
use App\Models\UserRelation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The search page: technicians, offers and repair requests, one kind at a
 * time or all three together.
 *
 * Customers cannot be searched. Their repair requests can be found by what
 * they say (the description, the categories, the city), never by the name of
 * the person who posted them, and a customer has no card of their own.
 *
 * With nothing to search for (no words, no filter, no location) the page
 * lists nothing: it waits for the person to ask. Picking a kind alone is not
 * a search.
 *
 * "All" shows a short preview of each kind, with the total for each so the
 * page can offer "see all". Picking one kind pages through all its results.
 * The location tools (distance, radius, map) belong to technicians only:
 * offers and requests have no position of their own.
 */
class SearchController extends Controller
{
    private const EARTH_RADIUS_KM = 6371;

    private const KM_PER_DEGREE_LAT = 111.32;

    /** Most technicians drawn on the search map. */
    private const MAP_LIMIT = 200;

    /**
     * Decimal places kept of a technician's coordinates on the map: 2 snaps a
     * pin to a grid about 1 km wide. Profiles promise that only the city is
     * public, so the map shows the neighbourhood and never the exact spot.
     */
    private const MAP_PRECISION = 2;

    /** What the search looks for: everything (the default), or one kind. */
    private const TYPES = ['all', 'technicians', 'offers', 'requests'];

    /** Results per page when one kind is picked. */
    private const PER_PAGE = 12;

    /** Results of each kind in the "all" preview. */
    private const PREVIEW = ['technicians' => 8, 'offers' => 4, 'requests' => 4];

    public function index(Request $request): Response
    {
        $viewer = $request->user();
        $type = $this->type($request);

        // People who blocked you, or that you blocked, are not in the results.
        $blockedIds = UserRelation::blockedIdsFor($viewer);

        $favoriteIds = UserRelation::where('user_id', $viewer->id)
            ->where('type', UserRelation::FAVORITE)
            ->pluck('target_id')
            ->all();

        // The location tools only mean something for technicians.
        $geo = $type === 'technicians' ? $this->geoParams($request) : null;

        $technicians = $this->technicianQuery($request, $blockedIds, $favoriteIds, $geo);
        $offers = $this->offerQuery($request, $blockedIds, $favoriteIds);
        $requests = $this->requestQuery($request, $blockedIds, $viewer);

        // Nothing asked for, nothing listed (the counts and the map are empty too).
        $searching = $this->isSearching($request, $geo);

        if (! $searching) {
            foreach ([$technicians, $offers, $requests] as $query) {
                $query->whereRaw('1 = 0');
            }
        }

        // Everything the technician filters match goes on the map, not just this page of results.
        $mapQuery = $type === 'technicians' ? clone $technicians : null;

        $props = ['technicians' => null, 'offers' => null, 'requests' => null];
        $counts = [];

        foreach (['technicians' => $technicians, 'offers' => $offers, 'requests' => $requests] as $kind => $query) {
            if ($type === 'all' || $type === $kind) {
                $this->sort($kind, $query, $request, $geo !== null);

                $page = $this->page($query, $type === 'all' ? self::PREVIEW[$kind] : self::PER_PAGE, $type === 'all');

                $props[$kind] = $this->cards($kind, $page, $viewer, $favoriteIds);
                $counts[$kind] = $page->total();
            } else {
                // Not on show, but the tabs still say how many it would have.
                $counts[$kind] = $query->count();
            }
        }

        return Inertia::render('Search/Index', $props + [
            'searching' => $searching,
            'counts' => $counts,
            'mapPoints' => $mapQuery ? $this->mapPoints($mapQuery) : [],
            'categories' => Category::orderBy('name')->get(),
            // Cast to an object: an empty PHP array reaches the browser as a JS
            // array, where `filters.sort` is Array.prototype.sort, not "unset".
            'filters' => (object) $this->echoFilters($request, $type),
        ]);
    }

    /**
     * Whether there is anything to search for: words, a category, a city, an
     * availability, favorites only, or a location (only for the technician search).
     *
     * @param  array{0: float, 1: float, 2: float|null}|null  $geo
     */
    private function isSearching(Request $request, ?array $geo): bool
    {
        return $geo !== null
            || $request->boolean('favorites')
            || collect(['q', 'category', 'city', 'availability'])->contains(fn (string $key) => $this->text($request, $key) !== '');
    }

    /** The kind of result asked for. "technician", from the old technicians page, still works. */
    private function type(Request $request): string
    {
        $type = $this->text($request, 'type');

        return match (true) {
            in_array($type, self::TYPES, true) => $type,
            $type === 'technician' => 'technicians',
            default => 'all',
        };
    }

    /**
     * The filters the page starts from: what the URL carried, with the kind
     * spelled the way the page knows it and the location tools left out where
     * they do not apply.
     *
     * @return array<string, mixed>
     */
    private function echoFilters(Request $request, string $type): array
    {
        $filters = $request->only(['q', 'category', 'city', 'availability', 'lat', 'lng', 'radius', 'sort', 'favorites']);

        if ($type !== 'technicians') {
            unset($filters['lat'], $filters['lng'], $filters['radius']);
        }

        if ($request->filled('type')) {
            $filters['type'] = $type;
        }

        return $filters;
    }

    /**
     * The technicians that match. The profile table is joined once, up front,
     * so every filter and the sort share a single reference to it. The inner
     * join also guarantees each technician has a profile (user_id is unique,
     * so no duplicate rows).
     *
     * @param  array{0: float, 1: float, 2: float|null}|null  $geo
     */
    private function technicianQuery(Request $request, array $blockedIds, array $favoriteIds, ?array $geo): Builder
    {
        $query = User::query()
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->whereNull('users.suspended_at')
            ->whereNotIn('users.id', $blockedIds)
            ->select('users.*')
            ->with(['technicianProfile.categories']);

        // "Favorites only" narrows the search down to the technicians you starred.
        if ($request->boolean('favorites')) {
            $query->whereIn('users.id', $favoriteIds);
        }

        // Free text: the technician's name.
        $term = $this->text($request, 'q');

        if ($term !== '') {
            $query->whereRaw("users.name LIKE ? ESCAPE '!'", [$this->likePattern($term)]);
        }

        if ($category = $this->text($request, 'category')) {
            $query->whereHas('technicianProfile.categories', fn ($q) => $q->where('slug', $category));
        }

        if ($availability = $this->text($request, 'availability')) {
            $query->where('technician_profiles.availability_status', $availability);
        }

        if ($city = $this->text($request, 'city')) {
            $query->whereRaw("technician_profiles.city LIKE ? ESCAPE '!'", [$this->likePattern($city)]);
        }

        // Geo search: lat/lng adds a computed `distance` (km) column; a radius,
        // when given, also filters on it.
        if ($geo) {
            [$lat, $lng, $radiusKm] = $geo;
            [$distanceSql, $distanceBindings] = $this->haversineSql($lat, $lng);

            $query->selectRaw("$distanceSql AS distance", $distanceBindings);

            if ($radiusKm !== null) {
                // Cheap latitude bounding box first (uses the lat/lng index),
                // then the exact distance. The distance expression is repeated
                // in WHERE rather than using HAVING on the alias, so the
                // pagination count query (which drops the select list) works.
                $latDelta = $radiusKm / self::KM_PER_DEGREE_LAT;

                $query->whereNotNull('technician_profiles.latitude')
                    ->whereNotNull('technician_profiles.longitude')
                    ->whereBetween('technician_profiles.latitude', [$lat - $latDelta, $lat + $latDelta])
                    ->whereRaw("$distanceSql <= ?", [...$distanceBindings, $radiusKm]);
            }
        }

        return $query;
    }

    /**
     * The offers that match. Offers of suspended technicians, of technicians
     * without a profile and of anyone blocked never show up.
     */
    private function offerQuery(Request $request, array $blockedIds, array $favoriteIds): Builder
    {
        $query = Offer::query()
            ->join('users', 'users.id', '=', 'offers.technician_id')
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->whereNull('users.suspended_at')
            ->whereNotIn('users.id', $blockedIds)
            ->select('offers.*')
            ->with(['media', 'categories', 'technician.technicianProfile']);

        if ($request->boolean('favorites')) {
            $query->whereIn('users.id', $favoriteIds);
        }

        // Free text: the title, the description or the technician's name.
        $term = $this->text($request, 'q');

        if ($term !== '') {
            $like = $this->likePattern($term);

            $query->where(function ($q) use ($like) {
                $q->whereRaw("offers.title LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("offers.description LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("users.name LIKE ? ESCAPE '!'", [$like]);
            });
        }

        // The categories the technician tagged the offer with.
        if ($slug = $this->text($request, 'category')) {
            $query->whereExists(function ($q) use ($slug) {
                $q->selectRaw('1')
                    ->from('category_offer')
                    ->join('categories', 'categories.id', '=', 'category_offer.category_id')
                    ->whereColumn('category_offer.offer_id', 'offers.id')
                    ->where('categories.slug', $slug);
            });
        }

        if ($availability = $this->text($request, 'availability')) {
            $query->where('technician_profiles.availability_status', $availability);
        }

        if ($city = $this->text($request, 'city')) {
            $query->whereRaw("technician_profiles.city LIKE ? ESCAPE '!'", [$this->likePattern($city)]);
        }

        return $query;
    }

    /**
     * The open requests that match. Closed requests and those of suspended or
     * blocked customers are not listed.
     *
     * Only what the request says is searched: never the customer's name, since
     * customers cannot be searched. Availability and favorites belong to
     * technicians, so asking for either leaves the requests out.
     */
    private function requestQuery(Request $request, array $blockedIds, User $viewer): Builder
    {
        $query = ServiceRequest::query()
            ->open()
            ->fromActiveCustomers()
            ->whereNotIn('service_requests.customer_id', $blockedIds)
            ->select('service_requests.*')
            ->with(['customer:id,name,avatar_path,role', 'categories', 'media'])
            ->withCount('quotes')
            // Lets a technician see which requests they have already answered.
            ->withExists(['quotes as has_my_quote' => fn ($q) => $q->where('technician_id', $viewer->id)]);

        if ($request->filled('availability') || $request->boolean('favorites')) {
            return $query->whereRaw('1 = 0');
        }

        $term = $this->text($request, 'q');

        if ($term !== '') {
            $query->whereRaw("service_requests.description LIKE ? ESCAPE '!'", [$this->likePattern($term)]);
        }

        if ($slug = $this->text($request, 'category')) {
            $query->whereHas('categories', fn ($q) => $q->where('categories.slug', $slug));
        }

        if ($city = $this->text($request, 'city')) {
            $query->whereRaw("service_requests.city LIKE ? ESCAPE '!'", [$this->likePattern($city)]);
        }

        return $query;
    }

    /**
     * How each kind is ordered: technicians nearest first when asked (needs a
     * location) and otherwise best rated; offers newest first, or the best
     * rated technicians' offers first; requests newest first.
     *
     * @param  'technicians'|'offers'|'requests'  $kind
     */
    private function sort(string $kind, Builder $query, Request $request, bool $hasLocation): void
    {
        if ($kind === 'technicians') {
            if ($hasLocation && $request->input('sort') === 'distance') {
                // Technicians without coordinates have no distance; list them last.
                $query->orderByRaw('(technician_profiles.latitude IS NULL OR technician_profiles.longitude IS NULL)')
                    ->orderBy('distance');
            } else {
                $query->orderByDesc('technician_profiles.rating_avg');
            }

            // Tie-breaker so pagination order stays stable.
            $query->orderBy('users.id');

            return;
        }

        if ($kind === 'offers') {
            if ($request->input('sort') === 'rating') {
                $query->orderByDesc('technician_profiles.rating_avg')
                    ->orderByDesc('technician_profiles.rating_count');
            }

            $query->orderByDesc('offers.created_at')->orderByDesc('offers.id');

            return;
        }

        $query->orderByDesc('service_requests.created_at')->orderByDesc('service_requests.id');
    }

    /**
     * One page of results. The preview of the "all" search is always the first
     * page, whatever `page` says, and its page links are never used.
     */
    private function page(Builder $query, int $perPage, bool $preview): LengthAwarePaginator
    {
        return $query
            ->paginate($perPage, ['*'], 'page', $preview ? 1 : null)
            ->withQueryString();
    }

    /**
     * Swap every model of the page for its public card.
     *
     * Nobody is sent to the browser as a raw model: that would ship their
     * email, phone, street address and exact coordinates to every logged-in
     * user, whatever the "show publicly" toggles say. Only the fields of the
     * cards leave the server.
     *
     * @param  'technicians'|'offers'|'requests'  $kind
     */
    private function cards(string $kind, LengthAwarePaginator $page, User $viewer, array $favoriteIds): LengthAwarePaginator
    {
        return $page->through(fn ($model) => match ($kind) {
            'technicians' => TechnicianController::summary($model) + ['is_favorite' => in_array($model->id, $favoriteIds, true)],
            'offers' => OfferController::card($model),
            'requests' => $model->toCard() + ['has_my_quote' => (bool) $model->has_my_quote],
        });
    }

    /**
     * The technicians to draw on the search map: everyone the filters match who
     * has a location, best rated first, up to MAP_LIMIT.
     *
     * Like the cards, a point carries only public fields, and its coordinates
     * are rounded (see MAP_PRECISION) so a pin never gives away the exact spot.
     *
     * @return list<array<string, mixed>>
     */
    private function mapPoints(Builder $query): array
    {
        return $query
            ->setEagerLoads([])
            ->select([
                'users.id',
                'users.name',
                'technician_profiles.latitude',
                'technician_profiles.longitude',
                'technician_profiles.city',
                'technician_profiles.availability_status',
                'technician_profiles.rating_avg',
                'technician_profiles.rating_count',
            ])
            ->whereNotNull('technician_profiles.latitude')
            ->whereNotNull('technician_profiles.longitude')
            ->orderByDesc('technician_profiles.rating_avg')
            ->orderBy('users.id')
            ->limit(self::MAP_LIMIT)
            ->get()
            ->map(fn (User $technician) => [
                'id' => $technician->id,
                'name' => $technician->name,
                'lat' => round((float) $technician->latitude, self::MAP_PRECISION),
                'lng' => round((float) $technician->longitude, self::MAP_PRECISION),
                'city' => $technician->city,
                'availability_status' => $technician->availability_status,
                'rating_avg' => $technician->rating_avg,
                'rating_count' => (int) $technician->rating_count,
            ])
            ->all();
    }

    /**
     * Read and sanity-check the geo query params.
     *
     * @return array{0: float, 1: float, 2: float|null}|null [lat, lng, radiusKm], or null when
     *         lat/lng are missing or out of range (the geo search is then skipped).
     */
    private function geoParams(Request $request): ?array
    {
        $lat = $request->input('lat');
        $lng = $request->input('lng');

        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return null;
        }

        $lat = (float) $lat;
        $lng = (float) $lng;

        if (abs($lat) > 90 || abs($lng) > 180) {
            return null;
        }

        $radius = $request->input('radius');
        $radiusKm = is_numeric($radius) && (float) $radius > 0 ? (float) $radius : null;

        return [$lat, $lng, $radiusKm];
    }

    /**
     * Haversine great-circle distance in km between the given point and each
     * technician profile. Returns the SQL expression and its 5 bindings.
     *
     * @return array{0: string, 1: array<int, float>}
     */
    private function haversineSql(float $lat, float $lng): array
    {
        $sql = '(2 * '.self::EARTH_RADIUS_KM.' * ASIN(SQRT(
            SIN(RADIANS(technician_profiles.latitude - ?) / 2) * SIN(RADIANS(technician_profiles.latitude - ?) / 2)
            + COS(RADIANS(?)) * COS(RADIANS(technician_profiles.latitude))
            * SIN(RADIANS(technician_profiles.longitude - ?) / 2) * SIN(RADIANS(technician_profiles.longitude - ?) / 2)
        )))';

        return [$sql, [$lat, $lat, $lat, $lng, $lng]];
    }

    /** A query value as trimmed text: anything that is not a plain string (`?q[]=x`) reads as empty. */
    private function text(Request $request, string $key): string
    {
        $value = $request->input($key);

        return is_string($value) ? trim($value) : '';
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

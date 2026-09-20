<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Offer;
use App\Models\Report;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The main page: one feed where technicians' offers and customers' repair
 * requests are posted together, with search and filters over both.
 *
 * A technician's own list of offers (with the forms to add and edit them) is
 * TechnicianOfferController, and the customer's own list of requests is
 * ServiceRequestController@mine. This page only browses, and hosts the two
 * "new" panels that post to those controllers.
 */
class FeedController extends Controller
{
    private const PER_PAGE = 12;

    /** How many technicians the "top rated" side list shows. */
    private const TOP_RATED_LIMIT = 5;

    /** The "type" filter: only the requests, or only the offers. Anything else shows both. */
    private const TYPES = ['requests', 'offers'];

    /** "images" and "videos" are matched on the content type checked at upload. */
    private const MEDIA_FILTERS = ['any', 'image', 'video'];

    public function index(Request $request): Response
    {
        $user = $request->user();

        $feed = $this->rows($request)
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        // The page only carries ids and kinds so far; swap them for the cards.
        $feed->setCollection($this->cards($feed->getCollection(), $user));

        return Inertia::render('Feed/Index', [
            'feed' => $feed,
            'categories' => Category::orderBy('name')->get(),
            'topRated' => $this->topRated((string) $request->input('top_category')),
            'reportReasons' => Report::REASONS,
            // What the "New request" and "New offer" panels need. Admins post
            // neither, and only technicians have offers.
            'requestForm' => $user->role === 'admin'
                ? null
                : ServiceRequestController::formProps() + ['defaultCity' => $user->city],
            'offerForm' => $user->role === 'technician' ? TechnicianOfferController::formProps() : null,
            // Cast to an object: an empty PHP array reaches the browser as a JS
            // array, where `filters.sort` is Array.prototype.sort, not "unset".
            'filters' => (object) $request->only(['q', 'type', 'category', 'city', 'availability', 'media', 'sort', 'top_category']),
        ]);
    }

    /**
     * The feed as one ordered list of (kind, id) rows: the offers and the open
     * requests that match the filters, merged in a single query so that
     * sorting and pagination cover both. The full cards are loaded afterwards,
     * for the page's rows only.
     */
    private function rows(Request $request): QueryBuilder
    {
        $type = in_array($request->input('type'), self::TYPES, true) ? $request->input('type') : '';

        // Availability and pictures/videos belong to a technician and their
        // offers, so a request can never match them: asking for one leaves the
        // requests out.
        $offerOnlyFilter = $request->filled('availability') || in_array($request->input('media'), self::MEDIA_FILTERS, true);

        $queries = [];

        if ($type !== 'requests') {
            $queries[] = $this->offerRows($request)->toBase();
        }

        if ($type !== 'offers' && ! $offerOnlyFilter) {
            $queries[] = $this->requestRows($request)->toBase();
        }

        // "Only requests" together with an offers-only filter: nothing can match.
        if ($queries === []) {
            $queries[] = $this->offerRows($request)->whereRaw('1 = 0')->toBase();
        }

        $union = array_shift($queries);

        foreach ($queries as $query) {
            $union->unionAll($query);
        }

        $rows = DB::query()->fromSub($union, 'feed');

        // The kind is the last tie-breaker: an offer and a request can share an id.
        match ($request->input('sort')) {
            'oldest' => $rows->orderBy('feed_created_at')->orderBy('feed_id')->orderBy('feed_kind'),
            // Requests have no rating (null sorts last here): they come after every offer.
            'rating' => $rows->orderByDesc('feed_rating_avg')
                ->orderByDesc('feed_rating_count')
                ->orderByDesc('feed_created_at')
                ->orderByDesc('feed_id')
                ->orderBy('feed_kind'),
            default => $rows->orderByDesc('feed_created_at')->orderByDesc('feed_id')->orderBy('feed_kind'),
        };

        return $rows;
    }

    /**
     * The offers that match, as feed rows. Same shape as the technician
     * search: the profile table is joined once, so every filter and the sort
     * share a single reference to it. The inner join also drops offers of
     * technicians who have no profile, and offers of suspended technicians
     * never show up.
     */
    private function offerRows(Request $request): Builder
    {
        $query = Offer::query()
            ->join('users', 'users.id', '=', 'offers.technician_id')
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->whereNull('users.suspended_at')
            ->selectRaw("'offer' as feed_kind, offers.id as feed_id, offers.created_at as feed_created_at, technician_profiles.rating_avg as feed_rating_avg, technician_profiles.rating_count as feed_rating_count");

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

        return $query;
    }

    /**
     * The open requests that match, as feed rows. Closed requests and those of
     * suspended customers are not listed (a customer finds their own closed
     * ones under "My requests").
     */
    private function requestRows(Request $request): Builder
    {
        $query = ServiceRequest::query()
            ->open()
            ->fromActiveCustomers()
            ->selectRaw("'request' as feed_kind, service_requests.id as feed_id, service_requests.created_at as feed_created_at, null as feed_rating_avg, null as feed_rating_count");

        // Free text: matches the title or the description.
        $term = trim((string) $request->input('q'));

        if ($term !== '') {
            $like = $this->likePattern($term);

            $query->where(function ($q) use ($like) {
                $q->whereRaw("service_requests.title LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("service_requests.description LIKE ? ESCAPE '!'", [$like]);
            });
        }

        if ($request->filled('category')) {
            $slug = (string) $request->input('category');

            $query->whereHas('categories', fn ($q) => $q->where('categories.slug', $slug));
        }

        if ($request->filled('city')) {
            $query->whereRaw("service_requests.city LIKE ? ESCAPE '!'", [$this->likePattern((string) $request->input('city'))]);
        }

        return $query;
    }

    /**
     * Swap the (kind, id) rows of one page for their cards, keeping the order.
     * Each card carries its `kind` ("offer" or "request") for the page to tell
     * them apart: their ids can be the same.
     *
     * @param  Collection<int, object>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    private function cards(Collection $rows, User $viewer): Collection
    {
        $offers = Offer::query()
            ->with(['media', 'categories', 'technician.technicianProfile'])
            ->whereIn('id', $rows->where('feed_kind', 'offer')->pluck('feed_id'))
            ->get()
            ->keyBy('id');

        $requests = ServiceRequest::query()
            ->with(['customer:id,name,avatar_path,role', 'categories'])
            ->withCount('quotes')
            // Lets a technician see which requests they have already answered.
            ->withExists(['quotes as has_my_quote' => fn ($q) => $q->where('technician_id', $viewer->id)])
            ->whereIn('id', $rows->where('feed_kind', 'request')->pluck('feed_id'))
            ->get()
            ->keyBy('id');

        return $rows
            ->map(function (object $row) use ($offers, $requests) {
                if ($row->feed_kind === 'offer') {
                    $offer = $offers->get($row->feed_id);

                    return $offer ? ['kind' => 'offer'] + OfferController::card($offer) : null;
                }

                $serviceRequest = $requests->get($row->feed_id);

                return $serviceRequest
                    ? ['kind' => 'request'] + $serviceRequest->toCard() + ['has_my_quote' => (bool) $serviceRequest->has_my_quote]
                    : null;
            })
            // A row whose post was deleted between the two queries.
            ->filter()
            ->values();
    }

    /**
     * The best rated technicians, for the side list: best average first, more
     * reviews winning a tie. Technicians nobody has reviewed yet are not
     * "top rated", and suspended ones are left out. Public fields only.
     *
     * An optional category slug narrows the ranking down to technicians who
     * have at least one offer tagged with it, independent of the feed's own
     * category filter above.
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

<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TechnicianController extends Controller
{
    private const EARTH_RADIUS_KM = 6371;

    private const KM_PER_DEGREE_LAT = 111.32;

    public function index(Request $request)
    {
        // Join the profile table once, up front, so every filter and the sort
        // share a single reference to technician_profiles. The inner join also
        // guarantees each technician has a profile (user_id is unique, so no
        // duplicate rows).
        $query = User::query()
            ->join('technician_profiles', 'technician_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'technician')
            ->select('users.*')
            ->with(['technicianProfile.categories']);

        // Filter by category
        if ($request->filled('category')) {
            $query->whereHas('technicianProfile.categories', function ($q) use ($request) {
                $q->where('slug', $request->input('category'));
            });
        }

        // Filter by availability
        if ($request->filled('availability')) {
            $query->where('technician_profiles.availability_status', $request->input('availability'));
        }

        // Exact-city search
        if ($request->filled('city')) {
            $query->where('technician_profiles.city', $request->input('city'));
        }

        // Geo search: lat/lng adds a computed `distance` (km) column; a radius,
        // when given, also filters on it.
        $geo = $this->geoParams($request);

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

        // Sort: nearest first when asked (needs lat/lng), otherwise best rated.
        if ($geo && $request->input('sort') === 'distance') {
            // Technicians without coordinates have no distance; list them last.
            $query->orderByRaw('(technician_profiles.latitude IS NULL OR technician_profiles.longitude IS NULL)')
                ->orderBy('distance');
        } else {
            $query->orderByDesc('technician_profiles.rating_avg');
        }

        // Tie-breaker so pagination order stays stable.
        $query->orderBy('users.id');

        // through() keeps the paginator shape (data + links) the page expects,
        // but swaps every model for its public card.
        $technicians = $query->paginate(12)
            ->withQueryString()
            ->through(fn (User $technician) => $this->summary($technician));

        return Inertia::render('Technicians/Index', [
            'technicians' => $technicians,
            'categories' => Category::orderBy('name')->get(),
            'filters' => $request->only(['category', 'city', 'availability', 'lat', 'lng', 'radius', 'sort']),
        ]);
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

    public function show(Request $request, User $technician)
    {
        abort_unless($technician->role === 'technician', 404);

        $technician->load([
            'technicianProfile.categories',
            'reviewsReceived' => fn ($q) => $q->latest()->with('customer:id,name'),
        ]);

        // Only customers review. `canReview` says whether they've earned the
        // right to (see Review::conversationFor); `myReview` prefills the form.
        $viewer = $request->user();
        $isCustomer = $viewer->role === 'customer';

        return Inertia::render('Technicians/Show', [
            'technician' => $this->detail($technician),
            'canReview' => $isCustomer && Review::conversationFor($viewer, $technician) !== null,
            'myReview' => $isCustomer
                ? Review::where('customer_id', $viewer->id)
                    ->where('technician_id', $technician->id)
                    ->first(['rating', 'comment'])
                : null,
        ]);
    }

    /**
     * The public card shown in search results.
     *
     * Technicians are never sent to the browser as raw models: that would ship
     * their email, phone, street address and exact coordinates to every logged-in
     * user, whatever the "show publicly" toggles say (they were only honoured in
     * the React page, while the data was already in the page props). Only the
     * fields listed here leave the server.
     *
     * @return array<string, mixed>
     */
    private function summary(User $technician): array
    {
        $profile = $technician->technicianProfile;

        $data = [
            'id' => $technician->id,
            'name' => $technician->name,
            'technician_profile' => $profile ? [
                'city' => $profile->city,
                'availability_status' => $profile->availability_status,
                'rating_avg' => $profile->rating_avg,
                'rating_count' => $profile->rating_count,
                'categories' => $profile->categories
                    ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])
                    ->values()
                    ->all(),
            ] : null,
        ];

        // Added by the geo search; null for technicians who have no coordinates,
        // in which case the key is left out so the page shows no distance.
        $distance = $technician->getAttributes()['distance'] ?? null;

        if ($distance !== null) {
            $data['distance'] = round((float) $distance, 2);
        }

        return $data;
    }

    /**
     * The public profile page: the card plus bio, reviews and any contact
     * details the technician has chosen to make public.
     *
     * @return array<string, mixed>
     */
    private function detail(User $technician): array
    {
        $profile = $technician->technicianProfile;
        $data = $this->summary($technician);

        if ($profile) {
            $data['technician_profile'] += [
                'bio' => $profile->bio,
                'show_phone_publicly' => (bool) $profile->show_phone_publicly,
                'show_email_publicly' => (bool) $profile->show_email_publicly,
                'phone' => $profile->show_phone_publicly ? $profile->phone : null,
            ];
        }

        $data['email'] = $profile?->show_email_publicly ? $technician->email : null;

        $data['reviews_received'] = $technician->reviewsReceived
            ->map(fn ($review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'customer' => [
                    'id' => $review->customer->id,
                    'name' => $review->customer->name,
                ],
            ])
            ->values()
            ->all();

        return $data;
    }
}
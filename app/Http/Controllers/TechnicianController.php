<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TechnicianController extends Controller
{
    public function index(Request $request)
    {
        $query = User::where('role', 'technician')
            ->whereHas('technicianProfile')
            ->with(['technicianProfile.categories']);

        // Filter by category
        if ($request->filled('category')) {
            $query->whereHas('technicianProfile.categories', function ($q) use ($request) {
                $q->where('slug', $request->input('category'));
            });
        }

        // Filter by availability
        if ($request->filled('availability')) {
            $query->whereHas('technicianProfile', function ($q) use ($request) {
                $q->where('availability_status', $request->input('availability'));
            });
        }

        // Exact-city search
        if ($request->filled('city')) {
            $query->whereHas('technicianProfile', function ($q) use ($request) {
                $q->where('city', $request->input('city'));
            });
        }

        // Geo radius search (Haversine), only when lat/lng + radius given
        if ($request->filled(['lat', 'lng', 'radius'])) {
            $lat = (float) $request->input('lat');
            $lng = (float) $request->input('lng');
            $radiusKm = (float) $request->input('radius');

            $haversine = "(6371 * acos(cos(radians(?)) * cos(radians(technician_profiles.latitude))
                * cos(radians(technician_profiles.longitude) - radians(?))
                + sin(radians(?)) * sin(radians(technician_profiles.latitude))))";

            $query->join('technician_profiles as tp_geo', 'tp_geo.user_id', '=', 'users.id')
                ->whereNotNull('tp_geo.latitude')
                ->whereNotNull('tp_geo.longitude')
                ->select('users.*')
                ->selectRaw("$haversine AS distance", [$lat, $lng, $lat])
                ->havingRaw('distance <= ?', [$radiusKm]);
        }

        // Sort
        if ($request->input('sort') === 'distance' && $request->filled(['lat', 'lng'])) {
            $query->orderBy('distance');
        } else {
    $query->join('technician_profiles as tp_sort', 'tp_sort.user_id', '=', 'users.id')
            ->select('users.*')
            ->orderByDesc('tp_sort.rating_avg');
    }

        $technicians = $query->paginate(12)->withQueryString();

        return Inertia::render('Technicians/Index', [
            'technicians' => $technicians,
            'categories' => Category::orderBy('name')->get(),
            'filters' => $request->only(['category', 'city', 'availability', 'lat', 'lng', 'radius', 'sort']),
        ]);
    }

    public function show(User $technician)
    {
        abort_unless($technician->role === 'technician', 404);

        $technician->load([
            'technicianProfile.categories',
            'reviewsReceived' => fn ($q) => $q->latest()->with('customer:id,name'),
        ]);

        return Inertia::render('Technicians/Show', [
            'technician' => $technician,
        ]);
    }
}
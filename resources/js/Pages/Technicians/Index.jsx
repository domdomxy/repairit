import { useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

// Small OpenStreetMap preview centred on the given point. The box grows with the
// reported accuracy so a rough (Wi-Fi / IP based) fix still shows sensible context.
function mapEmbedUrl(lat, lng, accuracy) {
    const spanMeters = Math.max(accuracy ?? 0, 500) * 3;
    const latDelta = spanMeters / 111320;
    const lngDelta = latDelta / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
    const bbox = [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta].join(',');

    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}

function formatMeters(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export default function Index({ technicians, categories, filters }) {
    const [form, setForm] = useState({
        category: filters.category ?? '',
        city: filters.city ?? '',
        availability: filters.availability ?? '',
        lat: filters.lat ?? '',
        lng: filters.lng ?? '',
        radius: filters.radius ?? '10',
        sort: filters.sort ?? 'rating',
    });
    const [locating, setLocating] = useState(false);
    const [accuracy, setAccuracy] = useState(null); // metres, only known right after "Use my location"

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function submit(e) {
        e?.preventDefault();

        // Only send non-empty filters, keep the URL clean
        const params = Object.fromEntries(
            Object.entries(form).filter(([, value]) => value !== '' && value !== null)
        );

        router.get(route('technicians.index'), params, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function useMyLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setForm((current) => ({
                    ...current,
                    lat: position.coords.latitude.toFixed(7),
                    lng: position.coords.longitude.toFixed(7),
                    sort: 'distance',
                }));
                setAccuracy(Math.round(position.coords.accuracy));
                setLocating(false);
            },
            () => {
                alert('Could not get your location.');
                setLocating(false);
            }
        );
    }

    function clearLocation() {
        setForm((current) => ({ ...current, lat: '', lng: '', sort: 'rating' }));
        setAccuracy(null);
    }

    const hasLocation = form.lat !== '' && form.lng !== '';

    const latNum = parseFloat(form.lat);
    const lngNum = parseFloat(form.lng);
    const showLocationPanel = hasLocation && Number.isFinite(latNum) && Number.isFinite(lngNum);

    // The location was just detected but the results below still reflect the previous search
    const searchPending =
        showLocationPanel &&
        (String(filters.lat ?? '') !== form.lat || String(filters.lng ?? '') !== form.lng);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Find a technician</h2>}>
            <div className="max-w-5xl mx-auto py-8 px-4">
                {/* Filters */}
                <form
                    onSubmit={submit}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
                >
                    <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <select
                            value={form.category}
                            onChange={(e) => update('category', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700"
                        >
                            <option value="">All categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.slug}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">City</label>
                        <input
                            type="text"
                            value={form.city}
                            onChange={(e) => update('city', e.target.value)}
                            placeholder="e.g. Ariana"
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Availability</label>
                        <select
                            value={form.availability}
                            onChange={(e) => update('availability', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700"
                        >
                            <option value="">Any</option>
                            <option value="available">Available</option>
                            <option value="busy">Busy</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Sort by</label>
                        <select
                            value={form.sort}
                            onChange={(e) => update('sort', e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:bg-gray-700"
                        >
                            <option value="rating">Highest rated</option>
                            <option value="distance" disabled={!hasLocation}>
                                Nearest {!hasLocation && '(set a location first)'}
                            </option>
                        </select>
                    </div>

                    {/* Geo radius controls */}
                    <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-end gap-4 pt-2 border-t dark:border-gray-700">
                        <div>
                            <button
                                type="button"
                                onClick={useMyLocation}
                                disabled={locating}
                                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md disabled:opacity-50"
                            >
                                {locating ? 'Locating…' : '📍 Use my location'}
                            </button>
                        </div>

                        {hasLocation && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Radius (km)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="200"
                                        value={form.radius}
                                        onChange={(e) => update('radius', e.target.value)}
                                        className="w-24 rounded-md border-gray-300 dark:bg-gray-700"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={clearLocation}
                                    className="text-sm text-gray-500 underline"
                                >
                                    Clear location
                                </button>
                            </>
                        )}

                        <button
                            type="submit"
                            className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-md"
                        >
                            Search
                        </button>
                    </div>

                    {/* Detected location */}
                    {showLocationPanel && (
                        <div className="sm:col-span-2 lg:col-span-4 rounded-lg border dark:border-gray-700 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                <div>
                                    <p className="font-medium">📍 Your location</p>
                                    <p className="text-gray-500">
                                        {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                                        {accuracy !== null && ` · accurate to about ${formatMeters(accuracy)}`}
                                    </p>
                                </div>
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lngNum}#map=15/${latNum}/${lngNum}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 underline"
                                >
                                    Open larger map ↗
                                </a>
                            </div>

                            <iframe
                                title="Map showing your location"
                                src={mapEmbedUrl(latNum, lngNum, accuracy)}
                                loading="lazy"
                                className="w-full h-56 border-0"
                            />

                            {searchPending && (
                                <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900">
                                    Press Search to see technicians near this location.
                                </p>
                            )}
                        </div>
                    )}
                </form>

                {/* Results */}
                {technicians.data.length === 0 && (
                    <p className="text-gray-500">No technicians match your search.</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {technicians.data.map((technician) => {
                        const profile = technician.technician_profile;
                        return (
                            <Link
                                key={technician.id}
                                href={route('technicians.show', technician.id)}
                                className="block bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold">{technician.name}</h3>
                                        <p className="text-sm text-gray-500">{profile?.city}</p>
                                    </div>
                                    <span
                                        className={`text-xs px-2 py-1 rounded-full capitalize ${
                                            profile?.availability_status === 'available'
                                                ? 'bg-green-100 text-green-700'
                                                : profile?.availability_status === 'busy'
                                                ? 'bg-yellow-100 text-yellow-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {profile?.availability_status}
                                    </span>
                                </div>

                                <p className="text-sm mt-2">
                                    ⭐ {profile?.rating_avg ?? '—'} ({profile?.rating_count ?? 0})
                                    {technician.distance !== undefined && (
                                        <span className="text-gray-500"> · {Number(technician.distance).toFixed(1)} km away</span>
                                    )}
                                </p>

                                <div className="flex flex-wrap gap-1 mt-2">
                                    {profile?.categories?.slice(0, 3).map((category) => (
                                        <span
                                            key={category.id}
                                            className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full"
                                        >
                                            {category.name}
                                        </span>
                                    ))}
                                </div>
                            </Link>
                        );
                    })}
                </div>

                {/* Pagination */}
                {technicians.links.length > 3 && (
                    <div className="flex flex-wrap gap-1 mt-6">
                        {technicians.links.map((link, index) => (
                            <Link
                                key={index}
                                href={link.url ?? '#'}
                                dangerouslySetInnerHTML={{ __html: link.label }}
                                preserveScroll
                                className={`px-3 py-1 rounded-md text-sm ${
                                    link.active
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                } ${!link.url ? 'opacity-50 pointer-events-none' : ''}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
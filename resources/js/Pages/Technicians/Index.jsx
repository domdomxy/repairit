import { useEffect, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import KeywordSearchBar from '@/Components/KeywordSearchBar';
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

const AVAILABILITY_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

const SORT_OPTIONS = [
    { value: 'rating', label: 'Highest rated' },
    { value: 'distance', label: 'Nearest' },
];

// The search bar's select filters use 'all' for "not set"; the URL and the
// controller use an empty value, so these convert between the two.
const toBarValue = (value) => (value === '' || value == null ? 'all' : value);
const fromBarValue = (value) => (value === 'all' ? '' : value);

// Only send filters that are set, so the URL stays clean. The radius only means
// something once a location is set.
function buildParams(form) {
    const hasLocation = form.lat !== '' && form.lng !== '';

    return Object.fromEntries(
        Object.entries(form).filter(([key, value]) => {
            if (key === 'radius' && !hasLocation) return false;
            return value !== '' && value !== null;
        })
    );
}

export default function Index({ technicians, categories, filters }) {
    const [form, setForm] = useState({
        name: filters.name ?? '',
        category: filters.category ?? '',
        city: filters.city ?? '',
        availability: filters.availability ?? '',
        lat: filters.lat ?? '',
        lng: filters.lng ?? '',
        radius: filters.radius ?? '10',
        sort: filters.sort ?? '',
    });
    const [locating, setLocating] = useState(false);
    const [accuracy, setAccuracy] = useState(null); // metres, only known right after "Use my location"

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    // Results follow the bar as it changes: typing a name or picking a filter
    // searches after a short pause, so there is no Search button to press. The
    // last-sent query is remembered so the first render, and any change that ends
    // up producing the same query, never triggers a request.
    const lastSent = useRef(null);
    if (lastSent.current === null) {
        lastSent.current = JSON.stringify(buildParams(form));
    }

    useEffect(() => {
        const params = buildParams(form);
        const key = JSON.stringify(params);

        if (key === lastSent.current) return undefined;

        const timer = setTimeout(() => {
            lastSent.current = key;

            router.get(route('technicians.index'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [form]);

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
        setForm((current) => ({ ...current, lat: '', lng: '', sort: '' }));
        setAccuracy(null);
    }

    const hasLocation = form.lat !== '' && form.lng !== '';

    const latNum = parseFloat(form.lat);
    const lngNum = parseFloat(form.lng);
    const showLocationPanel = hasLocation && Number.isFinite(latNum) && Number.isFinite(lngNum);

    // Keywords offered by the search bar. Sorting only has a second option once
    // there is a location to measure distance from, so that filter appears then.
    const searchFilters = [
        {
            key: 'category',
            keyword: 'category',
            description: 'Filter by repair category',
            options: categories.map((category) => ({ value: category.slug, label: category.name })),
            value: toBarValue(form.category),
            onChange: (value) => update('category', fromBarValue(value)),
        },
        {
            key: 'city',
            keyword: 'city',
            description: 'Filter by city',
            kind: 'text',
            value: form.city,
            onChange: (value) => update('city', value),
        },
        {
            key: 'availability',
            keyword: 'availability',
            description: 'Filter by availability',
            options: AVAILABILITY_OPTIONS,
            value: toBarValue(form.availability),
            onChange: (value) => update('availability', fromBarValue(value)),
        },
        ...(hasLocation
            ? [
                  {
                      key: 'sort',
                      keyword: 'sort',
                      description: 'Order the results',
                      options: SORT_OPTIONS,
                      value: toBarValue(form.sort),
                      onChange: (value) => update('sort', fromBarValue(value)),
                  },
              ]
            : []),
    ];

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Find a technician</h2>}>
            <div className="max-w-5xl mx-auto py-8 px-4">
                {/* Search and filters */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 space-y-4">
                    <KeywordSearchBar
                        value={form.name}
                        onChange={(value) => update('name', value)}
                        filters={searchFilters}
                        placeholder="Search technicians by name"
                        className="w-full"
                    />

                    {/* Geo radius controls */}
                    <div className="flex flex-wrap items-end gap-4">
                        <button
                            type="button"
                            onClick={useMyLocation}
                            disabled={locating}
                            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-md disabled:opacity-50"
                        >
                            {locating ? 'Locating…' : '📍 Use my location'}
                        </button>

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
                    </div>

                    {/* Detected location */}
                    {showLocationPanel && (
                        <div className="rounded-lg border dark:border-gray-700 overflow-hidden">
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
                        </div>
                    )}
                </div>

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
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar user={technician} size="md" />
                                        <div className="min-w-0">
                                            <h3 className="truncate font-semibold">{technician.name}</h3>
                                            <p className="text-sm text-gray-500">{profile?.city}</p>
                                        </div>
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
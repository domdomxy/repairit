import { useEffect, useRef, useState } from 'react';
import { Link, router } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import KeywordSearchBar from '@/Components/KeywordSearchBar';
import TechnicianMap from '@/Components/TechnicianMap';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

function formatMeters(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

const AVAILABILITY_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

// Who the search looks for. Technicians are what this page is for, so that is
// the default; the other two are for finding customers too.
const SCOPES = [
    {
        value: 'all',
        label: 'All',
        placeholder: 'Search technicians and customers by name',
        empty: 'No technicians or customers match your search.',
    },
    {
        value: 'technician',
        label: 'Technicians',
        placeholder: 'Search technicians by name',
        empty: 'No technicians match your search.',
    },
    {
        value: 'customer',
        label: 'Customers',
        placeholder: 'Search customers by name',
        empty: 'No customers match your search.',
    },
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
            if (key === 'type' && value === 'technician') return false;
            return value !== '' && value !== null;
        })
    );
}

export default function Index({ technicians, mapPoints, categories, filters }) {
    const [form, setForm] = useState({
        type: SCOPES.some((scope) => scope.value === filters.type) ? filters.type : 'technician',
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
    // The map is opt-in: it opens on the right, above the results, when asked for.
    const [showMap, setShowMap] = useState(false);
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

    // Category, city, availability and location only mean something for
    // technicians, so leaving the technician search drops them, and the
    // controls for them go away.
    function changeScope(next) {
        if (next === form.type) return;

        setForm((current) =>
            next === 'technician'
                ? { ...current, type: next }
                : { ...current, type: next, category: '', city: '', availability: '', lat: '', lng: '', sort: '' }
        );
        setAccuracy(null);
        setShowMap(false);
    }

    function clearLocation() {
        setForm((current) => ({ ...current, lat: '', lng: '', sort: '' }));
        setAccuracy(null);
    }

    const scope = SCOPES.find((option) => option.value === form.type);
    const isTechnicianScope = form.type === 'technician';

    const hasLocation = form.lat !== '' && form.lng !== '';

    const latNum = parseFloat(form.lat);
    const lngNum = parseFloat(form.lng);
    const showLocationPanel = hasLocation && Number.isFinite(latNum) && Number.isFinite(lngNum);

    // Keywords offered by the search bar. Sorting only has a second option once
    // there is a location to measure distance from, so that filter appears then.
    const searchFilters = !isTechnicianScope ? [] : [
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
        <AuthenticatedLayout>
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Left: the filters */}
                    <aside className="relative z-10 w-full lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
                        <div className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            {/* Who to look for */}
                            <div role="group" aria-label="Search for" className="grid grid-cols-3 gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-900">
                                {SCOPES.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => changeScope(option.value)}
                                        aria-pressed={form.type === option.value}
                                        className={`rounded px-2 py-1.5 text-sm font-medium transition ${
                                            form.type === option.value
                                                ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            <KeywordSearchBar
                                value={form.name}
                                onChange={(value) => update('name', value)}
                                filters={searchFilters}
                                placeholder={scope.placeholder}
                                className="w-full"
                            />

                            {/* Geo radius controls: technicians only */}
                            {isTechnicianScope && (
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={useMyLocation}
                                        disabled={locating}
                                        className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm disabled:opacity-50 dark:bg-gray-700"
                                    >
                                        {locating ? 'Locating…' : '📍 Use my location'}
                                    </button>

                                    {hasLocation && (
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <label className="mb-1 block text-sm font-medium">Radius (km)</label>
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
                                                className="pb-2 text-sm text-gray-500 underline"
                                            >
                                                Clear location
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setShowMap((current) => !current)}
                                        aria-pressed={showMap}
                                        className={`w-full rounded-md px-3 py-2 text-sm ${
                                            showMap
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700'
                                        }`}
                                    >
                                        🗺️ {showMap ? 'Hide map' : 'Show map'}
                                    </button>
                                </div>
                            )}

                            {/* Detected location */}
                            {isTechnicianScope && showLocationPanel && (
                                <div className="overflow-hidden rounded-lg border dark:border-gray-700">
                                    <div className="space-y-1 px-4 py-3 text-sm">
                                        <p className="font-medium">📍 Your location</p>
                                        <p className="text-gray-500">
                                            {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                                            {accuracy !== null && ` · accurate to about ${formatMeters(accuracy)}`}
                                        </p>
                                        <a
                                            href={`https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lngNum}#map=15/${latNum}/${lngNum}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-block text-indigo-600 underline"
                                        >
                                            Open larger map ↗
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Right: the results, with the map above them when it is switched on */}
                    <div className="min-w-0 flex-1 space-y-6">
                        {isTechnicianScope && showMap && (
                            <div className="isolate overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
                                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                                    <p className="font-medium">
                                        {mapPoints.length} technician{mapPoints.length === 1 ? '' : 's'} on the map
                                    </p>
                                    <p className="text-gray-500">
                                        Locations are approximate (about 1 km). Green is available, yellow busy, grey offline.
                                    </p>
                                </div>
                                <TechnicianMap
                                    points={mapPoints}
                                    origin={showLocationPanel ? { lat: latNum, lng: lngNum } : null}
                                    radiusKm={showLocationPanel && Number(form.radius) > 0 ? Number(form.radius) : null}
                                    className="h-80 w-full"
                                />
                            </div>
                        )}

                        <div>
                            {technicians.data.length === 0 && (
                                <p className="text-gray-500">{scope.empty}</p>
                            )}

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {technicians.data.map((technician) => {
                                    // A customer: just a name and a picture. There is no page to open.
                                    if (technician.role === 'customer') {
                                        return (
                                            <div
                                                key={`customer-${technician.id}`}
                                                className="flex items-center justify-between gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <Avatar user={technician} size="md" />
                                                    <h3 className="truncate font-semibold">{technician.name}</h3>
                                                </div>
                                                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                    Customer
                                                </span>
                                            </div>
                                        );
                                    }

                                    const profile = technician.technician_profile;
                                    return (
                                        <Link
                                            key={`technician-${technician.id}`}
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
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

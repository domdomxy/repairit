import { useEffect, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { PinIcon, StarIcon, TagIcon, WrenchIcon } from '@/Components/Icons';
import KeywordSearchBar from '@/Components/KeywordSearchBar';
import OfferListing from '@/Components/OfferListing';
import Pagination from '@/Components/Pagination';
import RequestCard from '@/Components/RequestCard';
import RequestMenu from '@/Components/RequestMenu';
import RequestQuoteAction from '@/Components/RequestQuoteAction';
import { TechnicianResult } from '@/Components/SearchResults';
import TechnicianMap from '@/Components/TechnicianMap';
import { AVAILABILITY } from '@/lib/availability';
import { findPlace } from '@/lib/geocode';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

function formatMeters(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

// What the page can look for. Customers are not on the list: they cannot be searched.
const TABS = [
    { value: 'all', label: 'All', placeholder: 'Search technicians, offers and requests' },
    { value: 'technicians', label: 'Technicians', placeholder: 'Search technicians by name' },
    { value: 'offers', label: 'Offers', placeholder: 'Search offers by title, description or technician' },
    { value: 'requests', label: 'Requests', placeholder: 'Search repair requests by what needs fixing' },
];

// The kinds of result, in the order "All" lists them.
const KINDS = {
    technicians: { title: 'Technicians', noun: 'technician', Icon: StarIcon },
    offers: { title: 'Offers', noun: 'offer', Icon: TagIcon },
    requests: { title: 'Requests', noun: 'request', Icon: WrenchIcon },
};

const AVAILABILITY_CHOICES = [
    { value: '', label: 'Any' },
    ...Object.entries(AVAILABILITY).map(([value, { label, dot }]) => ({ value, label, dot })),
];

// The order of one kind of result; '' is its usual order (best rated technicians, newest offers).
const SORT_OPTIONS = {
    technicians: [
        { value: '', label: 'Highest rated' },
        { value: 'distance', label: 'Nearest' },
    ],
    offers: [
        { value: '', label: 'Newest' },
        { value: 'rating', label: 'Best rated technicians' },
    ],
};

const RADIUS_DEFAULT = '10';

// Technicians are cards that fill the width they are given: as many columns as fit.
// Offers and requests are the cards of the feed, one under the other, like there.
const GRIDS = {
    technicians: 'gap-4 grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))]',
    offers: 'gap-5 grid-cols-1',
    requests: 'gap-5 grid-cols-1',
};

const LABEL = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
const FIELD =
    'block w-full rounded-lg border-gray-200 bg-gray-50 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300';
const BUTTON =
    'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600';

// The search bar's select filters use 'all' for "not set"; the URL and the
// controller use an empty value, so these convert between the two.
const toBarValue = (value) => (value === '' || value == null ? 'all' : value);
const fromBarValue = (value) => (value === 'all' ? '' : value);

// "technician" is what the old technicians page called its search.
function normalizeType(type) {
    if (type === 'technician') return 'technicians';

    return TABS.some((tab) => tab.value === type) ? type : 'all';
}

// Only send what is set and what applies, so the URL stays clean: the location
// belongs to the technician search, availability and favorites to technicians and
// their offers, and each kind has the orders of its own.
function buildParams(form) {
    const hasLocation = form.type === 'technicians' && form.lat !== '' && form.lng !== '';
    const sortIsValid =
        (form.type === 'technicians' && form.sort === 'distance' && hasLocation) ||
        (form.type === 'offers' && form.sort === 'rating');

    return Object.fromEntries(
        Object.entries(form).filter(([key, value]) => {
            if (value === '' || value === null) return false;
            if (key === 'type') return value !== 'all';
            if (key === 'lat' || key === 'lng' || key === 'radius') return hasLocation;
            if (key === 'sort') return sortIsValid;
            if (key === 'availability' || key === 'favorites') return form.type !== 'requests';

            return true;
        }),
    );
}

function LocateIcon({ className = 'h-4 w-4' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className={className}>
            <circle cx="12" cy="12" r="3.5" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="8" />
        </svg>
    );
}

function MapIcon({ className = 'h-4 w-4' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="m9 4-6 2v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
            <path d="M9 4v14M15 6v14" />
        </svg>
    );
}

function FilterIcon({ className = 'h-4 w-4' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />
        </svg>
    );
}

function SearchIcon({ className = 'h-8 w-8' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

function SearchOffIcon({ className = 'h-8 w-8' }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5M8.5 8.5l5 5M13.5 8.5l-5 5" />
        </svg>
    );
}

// A titled block of the filters column.
function Field({ label, children }) {
    return (
        <div>
            <span className={LABEL}>{label}</span>
            {children}
        </div>
    );
}

// The heading of a kind of result in "All", with the way to see the whole list.
function SectionHeader({ kind, total, shown, onSeeAll }) {
    const { title, Icon } = KINDS[kind];

    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-base font-semibold text-gray-900 dark:text-gray-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <Icon className="h-4 w-4" />
                </span>
                {title}
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {total}
                </span>
            </h2>

            {total > shown && (
                <button
                    type="button"
                    onClick={onSeeAll}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    See all {total} →
                </button>
            )}
        </div>
    );
}

// Before anything is asked for the page lists nothing: it waits for words or a filter.
function IdleState({ type }) {
    const what = type === 'all' ? 'technicians, offers and repair requests' : KINDS[type].title.toLowerCase();

    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800/40">
            <SearchIcon className="h-9 w-9 text-gray-400 dark:text-gray-500" />
            <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Search for {what}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Type a word above, or pick a category, a city or any other filter.
                </p>
            </div>
        </div>
    );
}

function EmptyState({ canReset, onReset }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800/40">
            <SearchOffIcon className="h-9 w-9 text-gray-400 dark:text-gray-500" />
            <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">Nothing matches your search</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Try other words, or loosen the filters.</p>
            </div>
            {canReset && (
                <button
                    type="button"
                    onClick={onReset}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                >
                    Reset filters
                </button>
            )}
        </div>
    );
}

// One kind of result as a grid of cards.
function ResultGrid({ kind, items, reportReasons, quoteLimits }) {
    return (
        <div className={`grid ${GRIDS[kind]}`}>
            {items.map((item) => {
                if (kind === 'technicians') return <TechnicianResult key={item.id} technician={item} />;
                if (kind === 'offers') return <OfferListing key={item.id} offer={item} reportReasons={reportReasons} />;

                return (
                    <RequestCard
                        key={item.id}
                        request={item}
                        footer={<RequestQuoteAction request={item} limits={quoteLimits} />}
                        menu={<RequestMenu request={item} reasons={reportReasons} />}
                    />
                );
            })}
        </div>
    );
}

export default function Index({
    technicians,
    offers,
    requests,
    searching,
    counts,
    mapPoints,
    categories,
    filters,
    reportReasons,
    quoteLimits,
}) {
    const [form, setForm] = useState({
        type: normalizeType(filters.type),
        q: filters.q ?? '',
        category: filters.category ?? '',
        city: filters.city ?? '',
        availability: filters.availability ?? '',
        favorites: filters.favorites ?? '',
        sort: filters.sort ?? '',
        lat: filters.lat ?? '',
        lng: filters.lng ?? '',
        radius: filters.radius ?? RADIUS_DEFAULT,
    });
    const [loading, setLoading] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false); // on a phone, where the filters fold away
    const [locating, setLocating] = useState(false);
    // The map is opt-in: it opens on the right of the results when asked for.
    const [showMap, setShowMap] = useState(false);
    const [accuracy, setAccuracy] = useState(null); // metres, only known right after "Use my location"
    // Where the location came from when it was not the browser's: 'map' (picked or
    // dragged on the map) or 'address' (typed). The person's correction, so no accuracy.
    const [placedBy, setPlacedBy] = useState(null);
    const [address, setAddress] = useState('');
    const [finding, setFinding] = useState(false);
    const [locationError, setLocationError] = useState('');

    // The browser's location is often a rough guess (a whole district, or a
    // network's position). Past this it is worth correcting by hand.
    const ROUGH_METRES = 1000;

    const results = { technicians, offers, requests };
    const type = form.type;
    // What the results on screen are, which lags behind the tab just clicked until the
    // server answers: all three kinds came back for "All", only the picked one otherwise.
    const present = Object.keys(KINDS).filter((kind) => results[kind] != null);
    const shownType = present.length === Object.keys(KINDS).length ? 'all' : present[0];
    const tab = TABS.find((option) => option.value === type);
    const isTechnicians = type === 'technicians';

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    // Results follow the bar and the filters as they change: typing or picking
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

            router.get(route('search.index'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [form]);

    function useMyLocation() {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
        }

        setLocating(true);
        setLocationError('');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setForm((current) => ({
                    ...current,
                    lat: position.coords.latitude.toFixed(7),
                    lng: position.coords.longitude.toFixed(7),
                    sort: 'distance',
                }));
                setAccuracy(Math.round(position.coords.accuracy));
                setPlacedBy(null);
                setLocating(false);
                // A rough fix is a good reason to open the map, to put it right.
                if (position.coords.accuracy > ROUGH_METRES) setShowMap(true);
            },
            () => {
                setLocationError('Could not get your location. Type an address instead, or click the map.');
                setLocating(false);
            },
        );
    }

    // Switching kind drops what only means something for the one left: the
    // location is for technicians, availability and favorites for technicians
    // and their offers, and each kind has its own orders.
    function changeType(next) {
        if (next === type) return;

        setForm((current) => ({
            ...current,
            type: next,
            sort: '',
            ...(next === 'technicians' ? {} : { lat: '', lng: '' }),
            ...(next === 'requests' ? { availability: '', favorites: '' } : {}),
        }));

        if (next !== 'technicians') {
            setAccuracy(null);
            setPlacedBy(null);
            setLocationError('');
            setShowMap(false);
        }
    }

    function clearLocation() {
        setForm((current) => ({ ...current, lat: '', lng: '', sort: '' }));
        setAccuracy(null);
        setPlacedBy(null);
        setLocationError('');
    }

    function resetFilters() {
        setForm((current) => ({
            ...current,
            category: '',
            city: '',
            availability: '',
            favorites: '',
            sort: '',
            lat: '',
            lng: '',
            radius: RADIUS_DEFAULT,
        }));
        setAccuracy(null);
        setPlacedBy(null);
        setLocationError('');
    }

    // The searcher set their location by hand: on the map, or from an address.
    function placeLocation(lat, lng, by) {
        setForm((current) => ({ ...current, lat: lat.toFixed(7), lng: lng.toFixed(7), sort: 'distance' }));
        setAccuracy(null);
        setPlacedBy(by);
        setLocationError('');
    }

    async function findAddress(event) {
        event.preventDefault();

        if (address.trim() === '' || finding) return;

        setFinding(true);
        setLocationError('');

        try {
            const place = await findPlace(address);

            if (place === null) {
                setLocationError('No match found. Try adding the city, or click the map.');
            } else {
                placeLocation(place.lat, place.lng, 'address');
                setShowMap(true);
            }
        } catch {
            setLocationError("Couldn't reach the address search. Try again in a moment, or click the map.");
        } finally {
            setFinding(false);
        }
    }

    const hasLocation = isTechnicians && form.lat !== '' && form.lng !== '';
    const latNum = parseFloat(form.lat);
    const lngNum = parseFloat(form.lng);
    const showLocationPanel = hasLocation && Number.isFinite(latNum) && Number.isFinite(lngNum);

    // How many filters are set (the words typed are not one of them): what the
    // "Reset" button and the phone's "Filters" button count.
    const activeFilters = [
        form.category,
        form.city,
        type !== 'requests' && form.availability,
        type !== 'requests' && form.favorites,
        hasLocation && form.lat,
    ].filter(Boolean).length;

    // Keywords offered by the search bar: the same filters as the column, as tags in the bar.
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
        ...(type === 'requests'
            ? []
            : [
                  {
                      key: 'availability',
                      keyword: 'availability',
                      description: 'Filter by availability',
                      options: Object.entries(AVAILABILITY).map(([value, { label }]) => ({ value, label })),
                      value: toBarValue(form.availability),
                      onChange: (value) => update('availability', fromBarValue(value)),
                  },
                  {
                      key: 'favorites',
                      keyword: 'favorites',
                      description: 'Only the technicians you starred',
                      options: [{ value: '1', label: 'Favorites only' }],
                      value: toBarValue(form.favorites),
                      onChange: (value) => update('favorites', fromBarValue(value)),
                  },
              ]),
    ];

    const totalCount = counts.technicians + counts.offers + counts.requests;
    const tabCount = (value) => (value === 'all' ? totalCount : counts[value]);

    const sortOptions = SORT_OPTIONS[type] ?? [];
    // Nearest first only exists once there is a location to measure from.
    const canSort = (type === 'offers' || hasLocation) && sortOptions.length > 0;

    const mapOpen = isTechnicians && shownType === 'technicians' && showMap;

    return (
        <AuthenticatedLayout stickyNav>
            <Head title="Search" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                    {/* Left: the filters. Pinned under the top bar on wide screens, folded away on a phone. */}
                    <aside className="w-full lg:sticky lg:top-[5.0625rem] lg:max-h-[calc(100vh-6.0625rem)] lg:w-80 lg:shrink-0 lg:overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setFiltersOpen((open) => !open)}
                            aria-expanded={filtersOpen}
                            className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow dark:bg-gray-800 dark:text-gray-200 lg:hidden"
                        >
                            <span className="flex items-center gap-2">
                                <FilterIcon />
                                Filters
                                {activeFilters > 0 && (
                                    <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">
                                        {activeFilters}
                                    </span>
                                )}
                            </span>
                            <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
                        </button>

                        <div className={`${filtersOpen ? 'mt-4 block' : 'hidden'} space-y-4 lg:mt-0 lg:block`}>
                            <div className="space-y-5 rounded-xl bg-white p-4 shadow dark:bg-gray-800">
                                <div className="flex items-center justify-between">
                                    <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                                        <FilterIcon />
                                        Filters
                                    </h2>
                                    {activeFilters > 0 && (
                                        <button
                                            type="button"
                                            onClick={resetFilters}
                                            className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>

                                <Field label="Category">
                                    <select
                                        value={form.category}
                                        onChange={(e) => update('category', e.target.value)}
                                        className={FIELD}
                                    >
                                        <option value="">All categories</option>
                                        {categories.map((category) => (
                                            <option key={category.slug} value={category.slug}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="City">
                                    <input
                                        type="text"
                                        value={form.city}
                                        onChange={(e) => update('city', e.target.value)}
                                        placeholder="Any city"
                                        className={FIELD}
                                    />
                                </Field>

                                {type !== 'requests' && (
                                    <>
                                        <Field label="Availability">
                                            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Availability">
                                                {AVAILABILITY_CHOICES.map((choice) => (
                                                    <button
                                                        key={choice.value}
                                                        type="button"
                                                        onClick={() => update('availability', choice.value)}
                                                        aria-pressed={form.availability === choice.value}
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition ${
                                                            form.availability === choice.value
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                                        }`}
                                                    >
                                                        {choice.dot && (
                                                            <span className={`h-2 w-2 rounded-full ${choice.dot}`} />
                                                        )}
                                                        {choice.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </Field>

                                        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200">
                                            <input
                                                type="checkbox"
                                                checked={form.favorites === '1'}
                                                onChange={(e) => update('favorites', e.target.checked ? '1' : '')}
                                                className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                                            />
                                            <span>
                                                Favorites only
                                                <span className="block text-xs text-gray-500 dark:text-gray-400">
                                                    Technicians you starred, and their offers
                                                </span>
                                            </span>
                                        </label>
                                    </>
                                )}
                            </div>

                            {/* The location tools: only technicians have a place. */}
                            {isTechnicians && (
                                <div className="space-y-3 rounded-xl bg-white p-4 shadow dark:bg-gray-800">
                                    <h2 className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                                        <PinIcon />
                                        Location
                                    </h2>

                                    <button type="button" onClick={useMyLocation} disabled={locating} className={BUTTON}>
                                        <LocateIcon />
                                        {locating ? 'Locating…' : 'Use my location'}
                                    </button>

                                    {/* Or say where: the browser's location is not always right. */}
                                    <form onSubmit={findAddress} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Or type an address or city"
                                            aria-label="Address or city to search from"
                                            className={`${FIELD} min-w-0 flex-1`}
                                        />
                                        <button
                                            type="submit"
                                            disabled={finding || address.trim() === ''}
                                            className="shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                        >
                                            {finding ? '…' : 'Find'}
                                        </button>
                                    </form>

                                    {locationError && (
                                        <p className="text-sm text-amber-600 dark:text-amber-400">{locationError}</p>
                                    )}

                                    {hasLocation && (
                                        <div className="flex items-end justify-between gap-3">
                                            <div>
                                                <label htmlFor="search-radius" className={LABEL}>
                                                    Radius (km)
                                                </label>
                                                <input
                                                    id="search-radius"
                                                    type="number"
                                                    min="1"
                                                    max="200"
                                                    value={form.radius}
                                                    onChange={(e) => update('radius', e.target.value)}
                                                    className={`${FIELD} w-24`}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={clearLocation}
                                                className="pb-2 text-sm text-gray-500 underline dark:text-gray-400"
                                            >
                                                Clear location
                                            </button>
                                        </div>
                                    )}

                                    {showLocationPanel && (
                                        <div className="space-y-1 rounded-lg bg-gray-50 px-3 py-3 text-sm dark:bg-gray-900/50">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">Your location</p>
                                            <p className="text-gray-500 dark:text-gray-400">
                                                {latNum.toFixed(5)}, {lngNum.toFixed(5)}
                                                {accuracy !== null && ` · accurate to about ${formatMeters(accuracy)}`}
                                                {placedBy === 'map' && ' · set on the map'}
                                                {placedBy === 'address' && ' · from your address'}
                                            </p>
                                            {accuracy !== null && accuracy > ROUGH_METRES && (
                                                <p className="text-amber-600 dark:text-amber-400">
                                                    This may be off. Click the map or drag the blue dot to put it where
                                                    you are.
                                                </p>
                                            )}
                                            {showMap ? (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Click the map or drag the blue dot to change it.
                                                </p>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMap(true)}
                                                    className="block text-indigo-600 underline dark:text-indigo-400"
                                                >
                                                    Not right? Adjust on the map
                                                </button>
                                            )}
                                            <a
                                                href={`https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lngNum}#map=15/${latNum}/${lngNum}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block text-indigo-600 underline dark:text-indigo-400"
                                            >
                                                Open larger map ↗
                                            </a>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setShowMap((current) => !current)}
                                        aria-pressed={showMap}
                                        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                            showMap
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        <MapIcon />
                                        {showMap ? 'Hide map' : 'Show map'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </aside>

                    {/* Right: the search bar and the kinds of result, then the results, with the map beside them when it is on. */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {/* Above the results and the map, so the bar's suggestion panel opens over them. */}
                        <div className="relative z-30 rounded-xl bg-white p-4 shadow dark:bg-gray-800">
                            <KeywordSearchBar
                                value={form.q}
                                onChange={(value) => update('q', value)}
                                filters={searchFilters}
                                placeholder={tab.placeholder}
                                className="w-full"
                            />

                            <div role="tablist" aria-label="Search in" className="mt-3 flex flex-wrap gap-1.5">
                                {TABS.map((option) => {
                                    const active = option.value === type;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            onClick={() => changeType(option.value)}
                                            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                                                active
                                                    ? 'bg-indigo-600 text-white shadow-sm'
                                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {option.label}
                                            {searching && (
                                                <span
                                                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                                                        active
                                                            ? 'bg-white/20 text-white'
                                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                                    }`}
                                                >
                                                    {tabCount(option.value)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 lg:gap-6">
                            <section
                                aria-busy={loading}
                                className={`min-w-0 flex-1 transition-opacity ${loading ? 'opacity-60' : ''}`}
                            >
                                {!searching ? (
                                    <IdleState type={type} />
                                ) : shownType === 'all' ? (
                                    totalCount === 0 ? (
                                        <EmptyState canReset={activeFilters > 0} onReset={resetFilters} />
                                    ) : (
                                        <div className="space-y-8">
                                            {Object.keys(KINDS).map((kind) =>
                                                results[kind]?.data.length > 0 ? (
                                                    <div key={kind}>
                                                        <SectionHeader
                                                            kind={kind}
                                                            total={counts[kind]}
                                                            shown={results[kind].data.length}
                                                            onSeeAll={() => changeType(kind)}
                                                        />
                                                        <ResultGrid
                                                            kind={kind}
                                                            items={results[kind].data}
                                                            reportReasons={reportReasons}
                                                            quoteLimits={quoteLimits}
                                                        />
                                                    </div>
                                                ) : null,
                                            )}
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                <span className="font-semibold text-gray-900 dark:text-gray-100">
                                                    {counts[shownType]}
                                                </span>{' '}
                                                {KINDS[shownType].noun}
                                                {counts[shownType] === 1 ? '' : 's'} found
                                                {hasLocation && Number(form.radius) > 0 && ` within ${form.radius} km of you`}
                                            </p>

                                            {canSort && (
                                                <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                    Sort by
                                                    <select
                                                        value={form.sort}
                                                        onChange={(e) => update('sort', e.target.value)}
                                                        className="rounded-lg border-gray-200 bg-white py-1 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                                                    >
                                                        {sortOptions.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}
                                        </div>

                                        {results[shownType].data.length === 0 ? (
                                            <EmptyState canReset={activeFilters > 0} onReset={resetFilters} />
                                        ) : (
                                            <ResultGrid
                                                kind={shownType}
                                                items={results[shownType].data}
                                                reportReasons={reportReasons}
                                                quoteLimits={quoteLimits}
                                            />
                                        )}

                                        <Pagination links={results[shownType].links} />
                                    </div>
                                )}
                            </section>

                            {/* The map, only when it was asked for: as wide as the results, and above them. */}
                            {mapOpen && (
                                <aside className="isolate order-first w-full overflow-hidden rounded-xl bg-white shadow dark:bg-gray-800">
                                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                                        <p className="font-medium text-gray-900 dark:text-gray-100">
                                            {mapPoints.length} technician{mapPoints.length === 1 ? '' : 's'} on the map
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            About 1 km accurate. Green available, yellow busy, grey offline.
                                        </p>
                                    </div>
                                    <TechnicianMap
                                        points={mapPoints}
                                        origin={showLocationPanel ? { lat: latNum, lng: lngNum } : null}
                                        radiusKm={showLocationPanel && Number(form.radius) > 0 ? Number(form.radius) : null}
                                        onPick={(lat, lng) => placeLocation(lat, lng, 'map')}
                                        className="h-80 w-full lg:h-[28rem]"
                                    />
                                </aside>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

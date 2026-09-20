import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import KeywordSearchBar from '@/Components/KeywordSearchBar';
import OfferListing from '@/Components/OfferListing';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import TopRatedTechnicians from '@/Components/TopRatedTechnicians';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

const AVAILABILITY_OPTIONS = [
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

const MEDIA_OPTIONS = [
    { value: 'any', label: 'Pictures or videos' },
    { value: 'image', label: 'Pictures' },
    { value: 'video', label: 'Videos' },
];

const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'rating', label: "Highest rated technician" },
];

// The search bar's select filters use 'all' for "not set"; the URL and the
// controller use an empty value, so these convert between the two.
const toBarValue = (value) => (value === '' || value == null ? 'all' : value);
const fromBarValue = (value) => (value === 'all' ? '' : value);

// Only send filters that are set, so the URL stays clean.
function buildParams(form) {
    return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '' && value !== null));
}

export default function Index({ offers, categories, topRated, filters, reportReasons }) {
    const { auth } = usePage().props;

    const [form, setForm] = useState({
        q: filters.q ?? '',
        category: filters.category ?? '',
        city: filters.city ?? '',
        availability: filters.availability ?? '',
        media: filters.media ?? '',
        sort: filters.sort ?? '',
        top_category: filters.top_category ?? '',
    });

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    // Results follow the bar as it changes: typing or picking a filter searches
    // after a short pause, so there is no Search button to press. The last-sent
    // query is remembered so the first render, and any change that ends up
    // producing the same query, never triggers a request.
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

            router.get(route('offers.index'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [form]);

    const searchFilters = [
        {
            key: 'category',
            keyword: 'category',
            description: 'Offers tagged with a repair category',
            options: categories.map((category) => ({ value: category.slug, label: category.name })),
            value: toBarValue(form.category),
            onChange: (value) => update('category', fromBarValue(value)),
        },
        {
            key: 'city',
            keyword: 'city',
            description: "Filter by the technician's city",
            kind: 'text',
            value: form.city,
            onChange: (value) => update('city', value),
        },
        {
            key: 'availability',
            keyword: 'availability',
            description: "Filter by the technician's availability",
            options: AVAILABILITY_OPTIONS,
            value: toBarValue(form.availability),
            onChange: (value) => update('availability', fromBarValue(value)),
        },
        {
            key: 'media',
            keyword: 'has',
            description: 'Only offers with pictures or videos',
            options: MEDIA_OPTIONS,
            value: toBarValue(form.media),
            onChange: (value) => update('media', fromBarValue(value)),
        },
        {
            key: 'sort',
            keyword: 'sort',
            description: 'Order the results',
            options: SORT_OPTIONS,
            value: toBarValue(form.sort),
            onChange: (value) => update('sort', fromBarValue(value)),
        },
    ];

    return (
        <AuthenticatedLayout>
            <div className="flex w-full flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Account rail: profile, dashboard, theme toggle, support. Stretched
                        to the row's height, which flex-1 above guarantees is at least the
                        remaining viewport, on any screen size, without a hardcoded vh figure. */}
                    <aside className="w-full lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    {/* Search and results. The search sits right on top of the offers, in the same column. */}
                    <div className="min-w-0 flex-1">
                        <div className="space-y-2 rounded-t-lg bg-white p-4 shadow dark:bg-gray-800">
                            <KeywordSearchBar
                                value={form.q}
                                onChange={(value) => update('q', value)}
                                filters={searchFilters}
                                placeholder="Search offers by title, description or technician"
                                className="w-full"
                            />
                            <p className="text-sm text-gray-500">
                                {offers.total} offer{offers.total === 1 ? '' : 's'} found
                            </p>
                        </div>

                        {offers.data.length === 0 && (
                            <p className="pt-4 text-gray-500">No offers match your search.</p>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {offers.data.map((offer) => (
                                <OfferListing key={offer.id} offer={offer} reportReasons={reportReasons} />
                            ))}
                        </div>

                        <Pagination links={offers.links} />
                    </div>

                    {/* The best rated technicians: beside the offers on wide screens, below them on small ones. */}
                    <aside className="w-full lg:sticky lg:top-4 lg:w-72 lg:shrink-0">
                        <TopRatedTechnicians
                            technicians={topRated}
                            categories={categories}
                            categoryValue={form.top_category}
                            onCategoryChange={(value) => update('top_category', value)}
                        />
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

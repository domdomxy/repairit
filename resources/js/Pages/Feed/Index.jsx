import { useEffect, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import KeywordSearchBar from '@/Components/KeywordSearchBar';
import Modal from '@/Components/Modal';
import OfferForm from '@/Components/OfferForm';
import OfferListing from '@/Components/OfferListing';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import TopRatedTechnicians from '@/Components/TopRatedTechnicians';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

const TYPE_OPTIONS = [
    { value: 'requests', label: 'Requests' },
    { value: 'offers', label: 'Offers' },
];

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

// A panel over the feed to write a new post. It can only be closed with its
// own buttons, so a stray click outside never throws away a half-written post.
function CreatePanel({ show, onClose, title, description, children }) {
    return (
        <Modal show={show} onClose={onClose} closeable={false} maxWidth="2xl">
            <div className="space-y-6 p-6">
                <header className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 rounded-md px-2 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                </header>

                {children}
            </div>
        </Modal>
    );
}

const NEW_POST_BUTTON =
    'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700';

// The feed: technicians' offers and customers' repair requests, posted
// together. `requestForm` and `offerForm` carry what the two "new" panels need;
// they are null for the roles that cannot post that kind (only technicians post
// offers, and admins post nothing).
export default function Index({ feed, categories, topRated, filters, reportReasons, requestForm, offerForm }) {
    const { auth } = usePage().props;

    // Which "new" panel is open, if any: 'request' or 'offer'.
    const [panel, setPanel] = useState(null);

    const [form, setForm] = useState({
        q: filters.q ?? '',
        type: filters.type ?? '',
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

            router.get(route('feed.index'), params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300);

        return () => clearTimeout(timer);
    }, [form]);

    const searchFilters = [
        {
            key: 'type',
            keyword: 'type',
            description: 'Only requests or only offers',
            options: TYPE_OPTIONS,
            value: toBarValue(form.type),
            onChange: (value) => update('type', fromBarValue(value)),
        },
        {
            key: 'category',
            keyword: 'category',
            description: 'Posts tagged with a repair category',
            options: categories.map((category) => ({ value: category.slug, label: category.name })),
            value: toBarValue(form.category),
            onChange: (value) => update('category', fromBarValue(value)),
        },
        {
            key: 'city',
            keyword: 'city',
            description: "Filter by the city of the request or of the technician",
            kind: 'text',
            value: form.city,
            onChange: (value) => update('city', value),
        },
        {
            key: 'availability',
            keyword: 'availability',
            description: "Only offers of technicians with this availability",
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

    // What the results are called: "3 offers found" once filtered down to a type.
    const noun = { offers: 'offer', requests: 'request' }[filters.type] ?? 'post';

    return (
        <AuthenticatedLayout>
            <Head title="Feed" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Account rail: profile, dashboard, theme toggle, support. Stretched
                        to the row's height, which flex-1 above guarantees is at least the
                        remaining viewport, on any screen size, without a hardcoded vh figure. */}
                    <aside className="w-full lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    {/* Search and results. The search is its own card above the posts. */}
                    <div className="min-w-0 flex-1 space-y-4">
                        <div className="space-y-2 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <KeywordSearchBar
                                value={form.q}
                                onChange={(value) => update('q', value)}
                                filters={searchFilters}
                                placeholder="Search the feed by title, description or technician"
                                className="w-full"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="text-sm text-gray-500">
                                    {feed.total} {noun}
                                    {feed.total === 1 ? '' : 's'} found
                                </p>

                                {/* Customers post requests; technicians choose between a request and an offer. */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {requestForm && (
                                        <button type="button" onClick={() => setPanel('request')} className={NEW_POST_BUTTON}>
                                            + New request
                                        </button>
                                    )}
                                    {offerForm && (
                                        <button type="button" onClick={() => setPanel('offer')} className={NEW_POST_BUTTON}>
                                            + New offer
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {feed.data.length === 0 && <p className="text-gray-500">No {noun}s match your search.</p>}

                        <div className="grid grid-cols-1 gap-4">
                            {feed.data.map((post) =>
                                post.kind === 'request' ? (
                                    <RequestCard
                                        key={`request-${post.id}`}
                                        request={post}
                                        showKind
                                        className="rounded-md border bg-white transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
                                    />
                                ) : (
                                    <OfferListing
                                        key={`offer-${post.id}`}
                                        offer={post}
                                        reportReasons={reportReasons}
                                        showKind
                                    />
                                ),
                            )}
                        </div>

                        <Pagination links={feed.links} />
                    </div>

                    {/* The best rated technicians: beside the feed on wide screens, below it on small ones. */}
                    <aside className="w-full lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
                        <TopRatedTechnicians
                            technicians={topRated}
                            categories={categories}
                            categoryValue={form.top_category}
                            onCategoryChange={(value) => update('top_category', value)}
                        />
                    </aside>
                </div>
            </div>

            {requestForm && (
                <CreatePanel
                    show={panel === 'request'}
                    onClose={() => setPanel(null)}
                    title="New request"
                    description="Describe what needs fixing. Technicians can see it and send you a quote. Your email and phone number are never shown."
                >
                    <RequestForm
                        categories={requestForm.categories}
                        limits={requestForm.limits}
                        defaultCity={requestForm.defaultCity}
                        inPanel
                        onDone={() => setPanel(null)}
                        onCancel={() => setPanel(null)}
                    />
                </CreatePanel>
            )}

            {offerForm && (
                <CreatePanel
                    show={panel === 'offer'}
                    onClose={() => setPanel(null)}
                    title="New offer"
                    description="Offers are shown in the feed and on your public profile. Add pictures or videos of your work to help customers choose you."
                >
                    <OfferForm
                        categories={offerForm.categories}
                        limits={offerForm.limits}
                        onDone={() => setPanel(null)}
                        onCancel={() => setPanel(null)}
                    />
                </CreatePanel>
            )}
        </AuthenticatedLayout>
    );
}

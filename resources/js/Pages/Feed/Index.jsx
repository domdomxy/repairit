import { useEffect, useRef, useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import CreatePanel from '@/Components/CreatePanel';
import { TagIcon, WrenchIcon } from '@/Components/Icons';
import FeedFilterMenu from '@/Components/FeedFilterMenu';
import OfferForm from '@/Components/OfferForm';
import OfferListing from '@/Components/OfferListing';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import RequestMenu from '@/Components/RequestMenu';
import RequestQuoteAction from '@/Components/RequestQuoteAction';
import TopRatedTechnicians from '@/Components/TopRatedTechnicians';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

// The filter menu under the composer. One choice at a time; "newest" is the
// default and is left out of the URL.
const FILTER_OPTIONS = [
    { value: 'newest', label: 'Newest posts', description: 'Show recent posts first' },
    { value: 'requests', label: 'Requests', description: "Only customers' repair requests" },
    { value: 'offers', label: 'Offers', description: "Only technicians' offers" },
    { value: 'rated', label: 'Most rated', description: 'Offers from the best rated technicians first' },
    { value: 'relevant', label: 'Most relevant', description: 'Posts in your categories and your city first' },
];

// These two can be narrowed to one category.
const CATEGORY_FILTERS = ['rated', 'relevant'];

// Where the menu starts: the `filter` in the URL, or the older `type` and
// `sort` parameters that links from before the menu still carry.
function initialFilter(filters) {
    if (FILTER_OPTIONS.some((option) => option.value === filters.filter)) return filters.filter;
    if (filters.type === 'requests' || filters.type === 'offers') return filters.type;

    return 'newest';
}

// Only send filters that are set, so the URL stays clean.
function buildParams(form) {
    return Object.fromEntries(
        Object.entries(form).filter(([key, value]) => value !== '' && value !== null && !(key === 'filter' && value === 'newest')),
    );
}

// The two ways to start a post, side by side under the composer.
const POST_ACTION =
    'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700';

// The feed: technicians' offers and customers' repair requests, posted
// together. `requestForm` and `offerForm` carry what the two "new" panels (and
// the "edit" ones, from a post's own menu) need; they are null for the roles
// that cannot post that kind (only technicians post offers, and admins post
// nothing). `quoteLimits` is set for technicians, who send a quote from a
// request's card.
export default function Index({ feed, categories, topRated, filters, reportReasons, requestForm, offerForm, quoteLimits }) {
    const { auth } = usePage().props;

    // Which "new" panel is open, if any: 'request' or 'offer'.
    const [panel, setPanel] = useState(null);

    // The post being edited from its menu, if any: { kind: 'request' | 'offer', post }.
    const [editing, setEditing] = useState(null);

    // Arriving from the nav bar's "create new post" button (feed?compose=request
    // or ?compose=offer) opens straight into that panel.
    useEffect(() => {
        const compose = new URLSearchParams(window.location.search).get('compose');

        if (compose === 'request' && requestForm) setPanel('request');
        if (compose === 'offer' && offerForm) setPanel('offer');
    }, []);

    const [form, setForm] = useState({
        filter: initialFilter(filters),
        category: filters.category ?? '',
        top_category: filters.top_category ?? '',
    });

    function update(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    // Results follow the menu as it changes: picking a filter loads it after a
    // short pause, so there is no button to press. The last-sent
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

    // Picking another choice from the menu drops the category, which only
    // "Most rated" and "Most relevant" have.
    function chooseFilter(value) {
        setForm((current) => ({
            ...current,
            filter: value,
            category: CATEGORY_FILTERS.includes(value) ? current.category : '',
        }));
    }

    // Deleting from a post's menu. The person stays on the feed (`from_panel`
    // keeps the request's delete from sending them to their own list).
    function deleteRequest(post) {
        if (!window.confirm('Delete this request and its quotes? This cannot be undone.')) return;

        router.delete(route('requests.destroy', { serviceRequest: post.id, from_panel: 1 }), { preserveScroll: true });
    }

    function deleteOffer(post) {
        if (!window.confirm(`Delete "${post.title}"? Its pictures and videos will be deleted too.`)) return;

        router.delete(route('technician.offers.destroy', post.id), { preserveScroll: true });
    }

    // Only technicians have offers of their own, so they are the ones whose
    // main post is an offer; everybody else posts a request.
    const mainPanel = offerForm ? 'offer' : requestForm ? 'request' : null;
    const canPost = mainPanel !== null;

    const filterOptions = FILTER_OPTIONS.map((option) =>
        option.value === 'relevant'
            ? {
                  ...option,
                  description:
                      auth.user.role === 'technician'
                          ? 'Posts in your specialties and your city first'
                          : 'Posts in your city and like your past requests first',
              }
            : option,
    );

    // What the results are called: "3 offers found" once filtered down to a type.
    const shown = filters.filter ?? filters.type;
    const noun = { offers: 'offer', rated: 'offer', requests: 'request' }[shown] ?? 'post';

    return (
        <AuthenticatedLayout stickyNav>
            <Head title="Feed" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    {/* Account rail: profile, dashboard, theme toggle, support. Pinned
                        under the top bar on wide screens: the page scrolls, these two stay put,
                        so only the feed moves. */}
                    <aside className="w-full lg:h-[calc(100vh-6.0625rem)] lg:w-72 lg:sticky lg:top-[5.0625rem] lg:max-h-[calc(100vh-6.0625rem)] lg:shrink-0 lg:overflow-y-auto">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    {/* Search and results. The search is its own card above the posts. */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {/* The composer: the feed's only way to post. Admins post nothing, so they don't get one. */}
                        {canPost && (
                            <div className="rounded-xl bg-white p-4 shadow dark:bg-gray-800">
                                <div className="flex items-center gap-3">
                                    <Avatar user={auth.user} size="md" />
                                    <button
                                        type="button"
                                        onClick={() => setPanel(mainPanel)}
                                        className="min-w-0 flex-1 truncate rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-start text-gray-500 transition hover:border-indigo-300 hover:bg-white dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-900"
                                    >
                                        {mainPanel === 'offer'
                                            ? 'Share an offer or ask for a repair…'
                                            : 'What needs fixing?'}
                                    </button>
                                </div>

                                {/* Customers post requests; technicians choose between a request and an offer. */}
                                <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                                    {requestForm && (
                                        <button type="button" onClick={() => setPanel('request')} className={POST_ACTION}>
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                                                <WrenchIcon className="h-4 w-4" />
                                            </span>
                                            New request
                                        </button>
                                    )}
                                    {offerForm && (
                                        <button type="button" onClick={() => setPanel('offer')} className={POST_ACTION}>
                                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                                                <TagIcon className="h-4 w-4" />
                                            </span>
                                            New offer
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* The filter menu, and the category for the two choices that have one. */}
                        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <FeedFilterMenu options={filterOptions} value={form.filter} onChange={chooseFilter} />

                                {CATEGORY_FILTERS.includes(form.filter) && (
                                    <select
                                        aria-label="Filter by category"
                                        value={form.category}
                                        onChange={(e) => update('category', e.target.value)}
                                        className="rounded-lg border-gray-200 bg-white py-1 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                    >
                                        <option value="">All categories</option>
                                        {categories.map((category) => (
                                            <option key={category.slug} value={category.slug}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">{feed.total}</span>{' '}
                                {noun}
                                {feed.total === 1 ? '' : 's'} found
                            </p>
                        </div>

                        {feed.data.length === 0 && (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
                                No {noun}s match this filter.
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-4">
                            {feed.data.map((post) =>
                                post.kind === 'request' ? (
                                    <RequestCard
                                        key={`request-${post.id}`}
                                        request={post}
                                        showKind
                                        footer={<RequestQuoteAction request={post} limits={quoteLimits} />}
                                        menu={
                                            <RequestMenu
                                                request={post}
                                                reasons={reportReasons}
                                                onEdit={() => setEditing({ kind: 'request', post })}
                                                onDelete={() => deleteRequest(post)}
                                            />
                                        }
                                        className="rounded-md border bg-white transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
                                    />
                                ) : (
                                    <OfferListing
                                        key={`offer-${post.id}`}
                                        offer={post}
                                        reportReasons={reportReasons}
                                        showKind
                                        onEdit={() => setEditing({ kind: 'offer', post })}
                                        onDelete={() => deleteOffer(post)}
                                    />
                                ),
                            )}
                        </div>

                        <Pagination links={feed.links} />
                    </div>

                    {/* The best rated technicians: beside the feed on wide screens, below it on small ones. */}
                    <aside className="w-full lg:w-80 lg:sticky lg:top-[5.0625rem] lg:max-h-[calc(100vh-6.0625rem)] lg:shrink-0 lg:overflow-y-auto">
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
                    kind="request"
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

            {requestForm && (
                <CreatePanel
                    kind="request"
                    show={editing?.kind === 'request'}
                    onClose={() => setEditing(null)}
                    title="Edit request"
                    description="Change what you wrote, or add and remove pictures and videos. Technicians see the new version."
                >
                    {editing?.kind === 'request' && (
                        <RequestForm
                            key={editing.post.id}
                            serviceRequest={editing.post}
                            categories={requestForm.categories}
                            limits={requestForm.limits}
                            inPanel
                            onDone={() => setEditing(null)}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </CreatePanel>
            )}

            {offerForm && (
                <CreatePanel
                    kind="offer"
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

            {offerForm && (
                <CreatePanel
                    kind="offer"
                    show={editing?.kind === 'offer'}
                    onClose={() => setEditing(null)}
                    title="Edit offer"
                    description="Change what customers see in the feed and on your public profile."
                >
                    {editing?.kind === 'offer' && (
                        <OfferForm
                            key={editing.post.id}
                            offer={editing.post}
                            categories={offerForm.categories}
                            limits={offerForm.limits}
                            onDone={() => setEditing(null)}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </CreatePanel>
            )}
        </AuthenticatedLayout>
    );
}

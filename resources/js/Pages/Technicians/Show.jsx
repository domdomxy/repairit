import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import FeedFilterMenu from '@/Components/FeedFilterMenu';
import FeedKindBadge from '@/Components/FeedKindBadge';
import Modal from '@/Components/Modal';
import OfferCard from '@/Components/OfferCard';
import OfferForm from '@/Components/OfferForm';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import ReviewForm from '@/Components/ReviewForm';
import ReviewReportButton from '@/Components/ReviewReportButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';

// Each of the three columns is a panel. They sit side by side on wide screens,
// stretched to the height of the page, and stack on small ones.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

// The filter menu over the posts of the middle column, the same one the feed has.
// (No "most rated" here: every post on this page is by the same technician.)
const FILTERS = [
    { value: 'newest', label: 'Newest posts', description: 'Show recent posts first' },
    { value: 'oldest', label: 'Oldest posts', description: 'Show the oldest posts first' },
    { value: 'requests', label: 'Requests', description: 'Only requests' },
    { value: 'offers', label: 'Offers', description: 'Only offers' },
];

const NEW_POST_BUTTON =
    'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60';

export default function Show({ technician, requests, canReview, myReview, offerForm, requestForm, reportReasons }) {
    const { auth } = usePage().props;
    const profile = technician.technician_profile;
    const isOwnProfile = auth.user.id === technician.id;

    const offers = technician.offers ?? [];
    const reviews = technician.reviews_received ?? [];
    const ratingCount = profile?.rating_count ?? 0;

    // The forms open in a panel: blank to create an offer or a request ('offer' | 'request'),
    // or an offer filled in to edit.
    const [creating, setCreating] = useState(null);
    const [editing, setEditing] = useState(null);
    const atLimit = offerForm ? offers.length >= offerForm.limits.max_offers : false;

    // Offers and requests are listed together, and can be searched, narrowed to
    // one kind or one category, and ordered. All of it happens here in the
    // browser: the page already carries every post of this technician.
    const [filter, setFilter] = useState('newest');
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');

    const allPosts = [
        ...offers.map((offer) => ({ kind: 'offer', ...offer })),
        ...(requests ?? []).map((request) => ({ kind: 'request', ...request })),
    ];

    // The categories these posts are actually tagged with, for the category select.
    const postCategories = [
        ...new Map(allPosts.flatMap((post) => post.categories ?? []).map((item) => [item.slug, item])).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));

    const term = search.trim().toLowerCase();
    const searching = term !== '' || category !== '';

    const matches = (post) =>
        term === '' ||
        [post.title, post.description, post.city, ...(post.categories ?? []).map((item) => item.name)]
            .filter(Boolean)
            .some((text) => text.toLowerCase().includes(term));

    const byDate = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;

    const posts = allPosts
        .filter((post) => filter !== 'requests' || post.kind === 'request')
        .filter((post) => filter !== 'offers' || post.kind === 'offer')
        .filter((post) => category === '' || (post.categories ?? []).some((item) => item.slug === category))
        .filter(matches)
        .sort((a, b) => (filter === 'oldest' ? -byDate(a, b) : byDate(a, b)));

    const noun = filter === 'requests' ? 'requests' : filter === 'offers' ? 'offers' : 'posts';
    // Only when both kinds are listed does the list need to say which is which.
    const showKind = filter !== 'requests' && filter !== 'offers';

    // The search bar sits beside the buttons that create a post when there are
    // any (the technician's own profile), and above the filters otherwise.
    const canCreate = isOwnProfile && (offerForm || requestForm);
    const searchBox = (
        <div className="relative min-w-[12rem] flex-1">
            <svg
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
            >
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l4 4" />
            </svg>
            <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search these posts by title, description or category"
                aria-label="Search the posts"
                className="w-full rounded-md border-gray-300 bg-white py-2 ps-9 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
        </div>
    );

    function contact() {
        router.post(route('conversations.start', technician.id));
    }

    return (
        <AuthenticatedLayout>
            <div className="flex w-full flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                    {/* Left: who the technician is */}
                    <section
                        aria-label="Technician information"
                        className={`${PANEL} w-full lg:w-72 lg:shrink-0 xl:w-1/4`}
                    >
                        <div className="flex items-center gap-4">
                            <Avatar user={technician} size="lg" />
                            <div className="min-w-0">
                                <h3 className="break-words text-lg font-semibold">{technician.name}</h3>
                                {profile?.city && <p className="text-sm text-gray-500">{profile.city}</p>}
                            </div>
                        </div>

                        <p className="mt-4 text-sm capitalize">Status: {profile?.availability_status}</p>

                        {isOwnProfile ? (
                            <Link
                                href={route('technician.profile.edit')}
                                className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-white hover:bg-indigo-700"
                            >
                                Edit profile
                            </Link>
                        ) : (
                            <button
                                onClick={contact}
                                className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                            >
                                Message
                            </button>
                        )}

                        {profile?.bio && <p className="mt-6 break-words text-sm">{profile.bio}</p>}

                        <div className="mt-4 flex flex-wrap gap-2">
                            {profile?.categories?.map((category) => (
                                <span
                                    key={category.id}
                                    className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700"
                                >
                                    {category.name}
                                </span>
                            ))}
                        </div>

                        {(profile?.show_phone_publicly || profile?.show_email_publicly) && (
                            <div className="mt-4 space-y-1 break-words text-sm">
                                {profile.show_phone_publicly && profile.phone && <p>Phone: {profile.phone}</p>}
                                {profile.show_email_publicly && <p>Email: {technician.email}</p>}
                            </div>
                        )}
                    </section>

                    {/* Middle: the create box in a card of its own, then their posts (offers and requests) with no panel behind them */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {canCreate && (
                            <section aria-label="Create a post" className={PANEL}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    {searchBox}

                                    {/* A technician chooses between a request and an offer. */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {requestForm && (
                                            <button type="button" onClick={() => setCreating('request')} className={NEW_POST_BUTTON}>
                                                + New request
                                            </button>
                                        )}
                                        {offerForm && (
                                            <button
                                                type="button"
                                                onClick={() => setCreating('offer')}
                                                disabled={atLimit}
                                                className={NEW_POST_BUTTON}
                                            >
                                                + New offer
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {atLimit && (
                                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                                        You have reached the limit of {offerForm.limits.max_offers} offers. Delete one to add
                                        another.
                                    </p>
                                )}
                            </section>
                        )}

                        <section aria-label="Posts">
                            <div className="mb-3 space-y-3 px-1">
                                {!canCreate && searchBox}

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <FeedFilterMenu options={FILTERS} value={filter} onChange={setFilter} />

                                        {postCategories.length > 0 && (
                                            <select
                                                aria-label="Filter the posts by category"
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                className="rounded-md border-gray-300 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                                            >
                                                <option value="">All categories</option>
                                                {postCategories.map((item) => (
                                                    <option key={item.slug} value={item.slug}>
                                                        {item.name}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <p className="text-sm text-gray-500">
                                        <span className="font-semibold text-gray-900 dark:text-gray-100">Posts</span> ·{' '}
                                        {posts.length} {noun.slice(0, -1)}
                                        {posts.length === 1 ? '' : 's'} found
                                    </p>
                                </div>
                            </div>

                            {posts.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    {searching
                                        ? `No ${noun} match your search.`
                                        : isOwnProfile
                                          ? `You have no ${noun} yet.`
                                          : `${technician.name} has no ${noun} yet.`}
                                </p>
                            )}
                            <ul className="space-y-3">
                                {posts.map((post) => (
                                    <li key={`${post.kind}-${post.id}`}>
                                        {post.kind === 'request' ? (
                                            <RequestCard
                                                request={post}
                                                scope={isOwnProfile ? 'mine' : 'all'}
                                                showAuthor={false}
                                                showKind={showKind}
                                            />
                                        ) : (
                                            <OfferCard
                                                offer={post}
                                                className="rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                                                menu={
                                                    <>
                                                        {showKind && <FeedKindBadge kind="offer" />}
                                                        <OfferMenu
                                                            offer={post}
                                                            isOwn={isOwnProfile}
                                                            onEdit={() => setEditing(post)}
                                                        />
                                                    </>
                                                }
                                            >
                                                <OfferShareActions
                                                    offer={post}
                                                    technicianId={technician.id}
                                                    showCopy={false}
                                                />
                                            </OfferCard>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {isOwnProfile && requestForm && (
                        <Modal show={creating === 'request'} onClose={() => setCreating(null)} maxWidth="2xl">
                            <div className="p-6">
                                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Create a new request
                                </h3>
                                <RequestForm
                                    categories={requestForm.categories}
                                    limits={requestForm.limits}
                                    defaultCity={requestForm.defaultCity}
                                    inPanel
                                    onDone={() => setCreating(null)}
                                    onCancel={() => setCreating(null)}
                                />
                            </div>
                        </Modal>
                    )}

                    {isOwnProfile && offerForm && (
                        <>
                            <Modal show={creating === 'offer'} onClose={() => setCreating(null)} maxWidth="2xl">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                                        Create a new offer
                                    </h3>
                                    <OfferForm
                                        limits={offerForm.limits}
                                        categories={offerForm.categories}
                                        onDone={() => setCreating(null)}
                                        onCancel={() => setCreating(null)}
                                    />
                                </div>
                            </Modal>

                            <Modal show={editing !== null} onClose={() => setEditing(null)} maxWidth="2xl">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                                        Edit offer
                                    </h3>
                                    {editing && (
                                        <OfferForm
                                            key={editing.id}
                                            offer={editing}
                                            limits={offerForm.limits}
                                            categories={offerForm.categories}
                                            onDone={() => setEditing(null)}
                                            onCancel={() => setEditing(null)}
                                        />
                                    )}
                                </div>
                            </Modal>
                        </>
                    )}

                    {/* Right: how they are rated, and the reviews behind it */}
                    <section aria-label="Reviews" className={`${PANEL} w-full lg:w-72 lg:shrink-0 xl:w-1/4`}>
                        <h4 className="font-semibold">Reviews</h4>

                        <p className="mb-4 mt-2 flex flex-wrap items-baseline gap-x-2">
                            <span className="text-3xl font-semibold">
                                ⭐ {ratingCount ? profile.rating_avg : '—'}
                            </span>
                            <span className="text-sm text-gray-500">
                                / 5 · {ratingCount} review{ratingCount === 1 ? '' : 's'}
                            </span>
                        </p>

                        {!isOwnProfile &&
                            (canReview ? (
                                <div className="mb-4 rounded-md border p-4 dark:border-gray-700">
                                    <h5 className="mb-3 text-sm font-medium">
                                        {myReview ? 'Your review' : 'Leave a review'}
                                    </h5>
                                    <ReviewForm
                                        key={myReview ? 'edit' : 'new'}
                                        technicianId={technician.id}
                                        review={myReview}
                                    />
                                </div>
                            ) : (
                                <p className="mb-4 text-sm text-gray-500">
                                    Once you and {technician.name} have exchanged messages, you can leave a
                                    review.
                                </p>
                            ))}

                        {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet.</p>}
                        <ul className="space-y-3">
                            {reviews.map((review) => (
                                <li key={review.id} className="rounded-md border p-3 dark:border-gray-700">
                                    <div className="flex items-start gap-3">
                                        <Avatar user={review.customer} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">
                                                {review.customer.role === 'customer' ? (
                                                    <Link
                                                        href={route('customers.show', review.customer.id)}
                                                        className="hover:underline"
                                                    >
                                                        {review.customer.name}
                                                    </Link>
                                                ) : (
                                                    review.customer.name
                                                )}{' '}
                                                — {review.rating}/5
                                            </p>
                                            {review.comment && (
                                                <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
                                                    {review.comment}
                                                </p>
                                            )}
                                            {/* Anyone but its author can report it */}
                                            {review.customer.id !== auth.user.id && (
                                                <ReviewReportButton
                                                    action={route('reviews.report', review.id)}
                                                    reasons={reportReasons}
                                                    authorName={review.customer.name}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

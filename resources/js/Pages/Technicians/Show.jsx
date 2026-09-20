import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
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

// The posts of the middle column: everything, or only the requests or the offers.
const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'requests', label: 'Requests' },
    { value: 'offers', label: 'Offers' },
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

    // Offers and requests are listed together, newest first, and can be filtered by kind.
    const [filter, setFilter] = useState('all');
    const posts = [
        ...offers.map((offer) => ({ kind: 'offer', ...offer })),
        ...(requests ?? []).map((request) => ({ kind: 'request', ...request })),
    ]
        .filter((post) => filter === 'all' || `${post.kind}s` === filter)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
    const noun = filter === 'all' ? 'posts' : filter;
    // Only when both kinds are listed does the list need to say which is which.
    const showKind = filter === 'all';

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
                        {isOwnProfile && (offerForm || requestForm) && (
                            <section aria-label="Create a post" className={PANEL}>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Create a new post</p>

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
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
                                <h4 className="font-semibold">Posts</h4>

                                <div role="group" aria-label="Filter the posts" className="flex gap-1">
                                    {FILTERS.map(({ value, label }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setFilter(value)}
                                            aria-pressed={filter === value}
                                            className={`rounded-full px-3 py-1 text-sm transition ${
                                                filter === value
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {posts.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    {isOwnProfile
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

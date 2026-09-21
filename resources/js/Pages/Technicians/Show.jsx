import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { ChatIcon, MailIcon, PencilIcon, PhoneIcon, PinIcon, StarIcon } from '@/Components/Icons';
import FeedFilterMenu from '@/Components/FeedFilterMenu';
import FeedKindBadge from '@/Components/FeedKindBadge';
import Modal from '@/Components/Modal';
import OfferCard from '@/Components/OfferCard';
import OfferForm from '@/Components/OfferForm';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import ProfileLinksSection from '@/Components/ProfileLinks';
import { Banner, ContactRow, SIDE_PANEL, Section, Stat } from '@/Components/ProfileParts';
import RelationActions from '@/Components/RelationActions';
import ReviewsPanel from '@/Components/ReviewsPanel';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AVAILABILITY } from '@/lib/availability';
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

export default function Show({ technician, requests, relations, canReview, myReview, offerForm, requestForm, reportReasons }) {
    const { auth } = usePage().props;
    const profile = technician.technician_profile;
    const isOwnProfile = auth.user.id === technician.id;

    const offers = technician.offers ?? [];
    const reviews = technician.reviews_received ?? [];
    const ratingCount = profile?.rating_count ?? 0;
    const availability = AVAILABILITY[profile?.availability_status] ?? null;


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
        <AuthenticatedLayout stickyNav>
            <div className="flex w-full flex-1 flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                    {/* Left: who the technician is */}
                    <section
                        aria-label="Technician information"
                        className={SIDE_PANEL}
                    >
                        <Banner />

                        <div className="px-6 pb-6">
                            <div className="relative -mt-12 w-fit">
                                <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                                    <Avatar user={technician} size="xl" />
                                </div>
                                {availability && (
                                    <span
                                        title={availability.label}
                                        className={`absolute bottom-1 end-1 h-4 w-4 rounded-full ring-2 ring-white dark:ring-gray-800 ${availability.dot}`}
                                    />
                                )}
                            </div>

                            <h3 className="mt-3 break-words text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {technician.name}
                            </h3>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                {availability && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${availability.pill}`}
                                    >
                                        <span className={`h-1.5 w-1.5 rounded-full ${availability.dot}`} />
                                        {availability.label}
                                    </span>
                                )}
                                {profile?.city && (
                                    <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                        <PinIcon className="h-4 w-4 text-gray-400" />
                                        {profile.city}
                                    </span>
                                )}
                            </div>

                            {isOwnProfile ? (
                                <Link
                                    href={route('technician.profile.edit')}
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    <PencilIcon />
                                    Edit profile
                                </Link>
                            ) : relations?.blocked ? (
                                <p className="mt-5 rounded-lg bg-gray-100 px-4 py-2.5 text-center text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    You blocked {technician.name}.
                                </p>
                            ) : (
                                <button
                                    onClick={contact}
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    <ChatIcon />
                                    Message
                                </button>
                            )}

                            {!isOwnProfile && (
                                <RelationActions person={technician} relations={relations} collapsible />
                            )}

                            <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                                <Stat label={ratingCount === 1 ? 'Review' : 'Reviews'}>
                                    {ratingCount > 0 ? (
                                        <>
                                            <StarIcon className="h-4 w-4 text-amber-400" />
                                            {Number(profile.rating_avg).toFixed(1)}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </Stat>
                                <Stat label={offers.length === 1 ? 'Offer' : 'Offers'}>{offers.length}</Stat>
                                <Stat label={(requests ?? []).length === 1 ? 'Request' : 'Requests'}>
                                    {(requests ?? []).length}
                                </Stat>
                            </div>

                            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
                                {profile?.bio && (
                                    <Section title="About">
                                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                            {profile.bio}
                                        </p>
                                    </Section>
                                )}

                                {profile?.categories?.length > 0 && (
                                    <Section title="Specialties">
                                        <div className="flex flex-wrap gap-1.5">
                                            {profile.categories.map((category) => (
                                                <span
                                                    key={category.id}
                                                    className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200"
                                                >
                                                    {category.name}
                                                </span>
                                            ))}
                                        </div>
                                    </Section>
                                )}

                                {((profile?.show_phone_publicly && profile.phone) || profile?.show_email_publicly) && (
                                    <Section title="Contact">
                                        <div className="space-y-0.5">
                                            {profile.show_phone_publicly && profile.phone && (
                                                <ContactRow
                                                    icon={<PhoneIcon />}
                                                    label="Phone"
                                                    value={profile.phone}
                                                    href={`tel:${profile.phone.replace(/[^\d+]/g, '')}`}
                                                />
                                            )}
                                            {profile.show_email_publicly && technician.email && (
                                                <ContactRow
                                                    icon={<MailIcon />}
                                                    label="Email"
                                                    value={technician.email}
                                                    href={`mailto:${technician.email}`}
                                                />
                                            )}
                                        </div>
                                    </Section>
                                )}

                                <ProfileLinksSection links={technician.links} />
                            </div>
                        </div>
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
                    <ReviewsPanel
                        average={profile?.rating_avg}
                        count={ratingCount}
                        reviews={reviews.map((review) => ({
                            id: review.id,
                            rating: review.rating,
                            comment: review.comment,
                            author: review.customer,
                            authorHref:
                                review.customer.role === 'customer' ? route('customers.show', review.customer.id) : null,
                        }))}
                        currentUserId={auth.user.id}
                        canRespond={!isOwnProfile}
                        canReview={canReview}
                        lockedText={`Once you and ${technician.name} have exchanged messages, you can leave a review.`}
                        myReview={myReview}
                        formProps={{ technicianId: technician.id }}
                        reportRoute={(id) => route('reviews.report', id)}
                        reportReasons={reportReasons}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

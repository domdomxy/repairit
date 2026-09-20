import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import Modal from '@/Components/Modal';
import OfferCard from '@/Components/OfferCard';
import OfferForm from '@/Components/OfferForm';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import ReviewForm from '@/Components/ReviewForm';
import ReviewReportButton from '@/Components/ReviewReportButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';

// Each of the three columns is a panel. They sit side by side on wide screens,
// stretched to the height of the page, and stack on small ones.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

export default function Show({ technician, canReview, myReview, offerForm, reportReasons }) {
    const { auth } = usePage().props;
    const profile = technician.technician_profile;
    const isOwnProfile = auth.user.id === technician.id;

    const offers = technician.offers ?? [];
    const reviews = technician.reviews_received ?? [];
    const ratingCount = profile?.rating_count ?? 0;

    // The offer form opens in a panel: blank to create, or filled in to edit.
    const [creating, setCreating] = useState(false);
    const [editing, setEditing] = useState(null);
    const atLimit = offerForm ? offers.length >= offerForm.limits.max_offers : false;

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

                    {/* Middle: the create box in a card of its own, then their offers with no panel behind them */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {isOwnProfile && offerForm && (
                            <section aria-label="Create an offer" className={PANEL}>
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    disabled={atLimit}
                                    className="block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-start text-sm text-gray-500 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                                >
                                    {atLimit
                                        ? `You have reached the limit of ${offerForm.limits.max_offers} offers`
                                        : 'Create a new offer'}
                                </button>
                            </section>
                        )}

                        <section aria-label="Offers">
                            <h4 className="mb-3 px-1 font-semibold">Offers</h4>

                            {offers.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    {isOwnProfile
                                        ? 'You have not added any offers yet.'
                                        : `${technician.name} has not added any offers yet.`}
                                </p>
                            )}
                            <ul className="space-y-3">
                                {offers.map((offer) => (
                                    <li key={offer.id}>
                                        <OfferCard
                                            offer={offer}
                                            className="rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                                            menu={
                                                <OfferMenu
                                                    offer={offer}
                                                    isOwn={isOwnProfile}
                                                    onEdit={() => setEditing(offer)}
                                                />
                                            }
                                        >
                                            <OfferShareActions
                                                offer={offer}
                                                technicianId={technician.id}
                                                showCopy={false}
                                            />
                                        </OfferCard>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {isOwnProfile && offerForm && (
                        <>
                            <Modal show={creating} onClose={() => setCreating(false)} maxWidth="2xl">
                                <div className="p-6">
                                    <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                                        Create a new offer
                                    </h3>
                                    <OfferForm
                                        limits={offerForm.limits}
                                        categories={offerForm.categories}
                                        onDone={() => setCreating(false)}
                                        onCancel={() => setCreating(false)}
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

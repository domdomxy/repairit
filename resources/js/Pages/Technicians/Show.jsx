import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import OfferCard from '@/Components/OfferCard';
import OfferShareActions from '@/Components/OfferShareActions';
import ReviewForm from '@/Components/ReviewForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

// Each of the three columns is a panel. They sit side by side on wide screens,
// stretched to the height of the page, and stack on small ones.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

export default function Show({ technician, canReview, myReview }) {
    const { auth } = usePage().props;
    const profile = technician.technician_profile;
    const isOwnProfile = auth.user.id === technician.id;

    const offers = technician.offers ?? [];
    const reviews = technician.reviews_received ?? [];
    const ratingCount = profile?.rating_count ?? 0;

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

                    {/* Middle: their offers */}
                    <section aria-label="Offers" className={`${PANEL} min-w-0 flex-1`}>
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h4 className="font-semibold">Offers</h4>
                            {isOwnProfile && (
                                <Link
                                    href={route('technician.offers.index')}
                                    className="text-sm text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                                >
                                    Manage offers
                                </Link>
                            )}
                        </div>

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
                                    <OfferCard offer={offer}>
                                        <OfferShareActions offer={offer} technicianId={technician.id} />
                                    </OfferCard>
                                </li>
                            ))}
                        </ul>
                    </section>

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
                                                {review.customer.name} — {review.rating}/5
                                            </p>
                                            {review.comment && (
                                                <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">
                                                    {review.comment}
                                                </p>
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

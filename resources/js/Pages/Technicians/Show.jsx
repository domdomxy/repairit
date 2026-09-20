import { Link, router, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import OfferCard from '@/Components/OfferCard';
import ReviewForm from '@/Components/ReviewForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Show({ technician, canReview, myReview }) {
    const { auth } = usePage().props;
    const profile = technician.technician_profile;
    const isOwnProfile = auth.user.id === technician.id;

    function contact() {
        router.post(route('conversations.start', technician.id));
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">{technician.name}</h2>}>
            <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                            <Avatar user={technician} size="lg" />
                            <div>
                                <h3 className="text-lg font-semibold">{technician.name}</h3>
                                <p className="text-sm text-gray-500">{profile?.city}</p>
                                <p className="text-sm mt-1">
                                    Rating: {profile?.rating_count ? profile.rating_avg : '—'} ({profile?.rating_count ?? 0} reviews)
                                </p>
                                <p className="text-sm mt-1 capitalize">
                                    Status: {profile?.availability_status}
                                </p>
                            </div>
                        </div>

                        {isOwnProfile ? (
                            <Link
                                href={route('technician.profile.edit')}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                            >
                                Edit profile
                            </Link>
                        ) : (
                            <button
                                onClick={contact}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                            >
                                Message
                            </button>
                        )}
                    </div>

                    {profile?.bio && <p className="mt-4 text-sm">{profile.bio}</p>}

                    <div className="mt-4 flex flex-wrap gap-2">
                        {profile?.categories?.map((category) => (
                            <span
                                key={category.id}
                                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full"
                            >
                                {category.name}
                            </span>
                        ))}
                    </div>

                    {(profile?.show_phone_publicly || profile?.show_email_publicly) && (
                        <div className="mt-4 text-sm space-y-1">
                            {profile.show_phone_publicly && profile.phone && (
                                <p>Phone: {profile.phone}</p>
                            )}
                            {profile.show_email_publicly && <p>Email: {technician.email}</p>}
                        </div>
                    )}
                </div>

                {(technician.offers?.length > 0 || isOwnProfile) && (
                    <div>
                        <div className="mb-2 flex items-center justify-between gap-4">
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

                        {technician.offers.length === 0 && (
                            <p className="text-sm text-gray-500">You have not added any offers yet.</p>
                        )}
                        <ul className="space-y-3">
                            {technician.offers.map((offer) => (
                                <li key={offer.id}>
                                    <OfferCard offer={offer} />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <h4 className="font-semibold mb-2">Reviews</h4>

                    {!isOwnProfile &&
                        (canReview ? (
                            <div className="mb-4 rounded-md border p-4">
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
                                Once you and {technician.name} have exchanged messages, you can
                                leave a review.
                            </p>
                        ))}

                    {technician.reviews_received?.length === 0 && (
                        <p className="text-sm text-gray-500">No reviews yet.</p>
                    )}
                    <ul className="space-y-3">
                        {technician.reviews_received?.map((review) => (
                            <li key={review.id} className="border rounded-md p-3">
                                <div className="flex items-start gap-3">
                                    <Avatar user={review.customer} size="sm" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">
                                            {review.customer.name} — {review.rating}/5
                                        </p>
                                        {review.comment && (
                                            <p className="text-sm text-gray-600 mt-1">{review.comment}</p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
import { Head, Link, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import ReviewForm from '@/Components/ReviewForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';

// Same panels as a technician's profile: who they are on the left, what
// technicians say about them on the right.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

export default function Show({ customer, canReview, myReview }) {
    const { auth } = usePage().props;
    const isOwnProfile = auth.user.id === customer.id;
    const isTechnician = auth.user.role === 'technician';

    const reviews = customer.reviews ?? [];
    const ratingCount = customer.rating_count ?? 0;

    return (
        <AuthenticatedLayout>
            <Head title={customer.name} />

            <div className="flex w-full flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                    {/* Left: who the customer is */}
                    <section aria-label="Customer information" className={`${PANEL} w-full lg:w-72 lg:shrink-0 xl:w-1/4`}>
                        <div className="flex items-center gap-4">
                            <Avatar user={customer} size="lg" />
                            <div className="min-w-0">
                                <h3 className="break-words text-lg font-semibold">{customer.name}</h3>
                                <p className="text-sm text-gray-500">Customer</p>
                            </div>
                        </div>

                        {customer.member_since && (
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                Member since {formatDate(customer.member_since)}
                            </p>
                        )}

                        {isOwnProfile && (
                            <Link
                                href={route('profile.edit')}
                                className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-white hover:bg-indigo-700"
                            >
                                Edit account
                            </Link>
                        )}
                    </section>

                    {/* Right: how technicians rate them */}
                    <section aria-label="Reviews" className={`${PANEL} min-w-0 flex-1`}>
                        <h4 className="font-semibold">Reviews</h4>

                        <p className="mb-4 mt-2 flex flex-wrap items-baseline gap-x-2">
                            <span className="text-3xl font-semibold">⭐ {ratingCount ? customer.rating_avg : '—'}</span>
                            <span className="text-sm text-gray-500">
                                / 5 · {ratingCount} review{ratingCount === 1 ? '' : 's'}
                            </span>
                        </p>

                        {!isOwnProfile &&
                            isTechnician &&
                            (canReview ? (
                                <div className="mb-4 rounded-md border p-4 dark:border-gray-700">
                                    <h5 className="mb-3 text-sm font-medium">
                                        {myReview ? 'Your review' : `Rate ${customer.name}`}
                                    </h5>
                                    <ReviewForm
                                        key={myReview ? 'edit' : 'new'}
                                        review={myReview}
                                        storeUrl={route('customer-reviews.store', customer.id)}
                                        destroyUrl={route('customer-reviews.destroy', customer.id)}
                                        placeholder="Share how working with them went (optional)"
                                    />
                                </div>
                            ) : (
                                <p className="mb-4 text-sm text-gray-500">
                                    Once you and {customer.name} have exchanged messages, you can rate them.
                                </p>
                            ))}

                        {reviews.length === 0 && <p className="text-sm text-gray-500">No reviews yet.</p>}
                        <ul className="space-y-3">
                            {reviews.map((review) => (
                                <li key={review.id} className="rounded-md border p-3 dark:border-gray-700">
                                    <div className="flex items-start gap-3">
                                        <Avatar user={review.technician} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium">
                                                <Link
                                                    href={route('technicians.show', review.technician.id)}
                                                    className="hover:underline"
                                                >
                                                    {review.technician.name}
                                                </Link>{' '}
                                                — {review.rating}/5
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

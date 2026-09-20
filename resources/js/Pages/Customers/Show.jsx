import { Head, Link, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import Modal from '@/Components/Modal';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import ReviewForm from '@/Components/ReviewForm';
import ReviewReportButton from '@/Components/ReviewReportButton';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';
import { useState } from 'react';

// Same three panels as a technician's profile, side by side on wide screens
// and stacked on small ones: who they are on the left, their repair requests
// in the middle, what technicians say about them on the right.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

export default function Show({ customer, requests, requestForm, canReview, myReview, reportReasons }) {
    const { auth } = usePage().props;
    const isOwnProfile = auth.user.id === customer.id;
    const isTechnician = auth.user.role === 'technician';

    const reviews = customer.reviews ?? [];
    const ratingCount = customer.rating_count ?? 0;

    // The request form opens in a panel, like a technician's offer form.
    const [creating, setCreating] = useState(false);

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
                                {customer.city && <p className="text-sm text-gray-500">{customer.city}</p>}
                            </div>
                        </div>

                        {customer.bio && <p className="mt-4 whitespace-pre-line break-words text-sm">{customer.bio}</p>}

                        {isOwnProfile && !customer.bio && !customer.city && (
                            <p className="mt-4 text-sm text-gray-500">
                                Nothing here yet. Add a short bio and your city by editing your profile so
                                technicians know who they are talking to.
                            </p>
                        )}

                        {customer.member_since && (
                            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                                Member since {formatDate(customer.member_since)}
                            </p>
                        )}

                        {isOwnProfile && (
                            <Link
                                href={route('customer.profile.edit')}
                                className="mt-4 block w-full rounded-md bg-indigo-600 px-4 py-2 text-center text-white hover:bg-indigo-700"
                            >
                                Edit profile
                            </Link>
                        )}
                    </section>

                    {/* Middle: the create box in a card of its own (on your own profile), then their requests with no panel behind them */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {isOwnProfile && requestForm && (
                            <section aria-label="Create a request" className={PANEL}>
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-start text-sm text-gray-500 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                                >
                                    Create a new request
                                </button>
                            </section>
                        )}

                        <section aria-label="Requests">
                            <div className="mb-3 flex items-center justify-between gap-3 px-1">
                                <h4 className="font-semibold">Requests</h4>
                                {/* The list shows the latest ones: their owner manages all of them from here. */}
                                {isOwnProfile && (
                                    <Link
                                        href={route('requests.mine')}
                                        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        My requests
                                    </Link>
                                )}
                            </div>

                            {requests.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    {isOwnProfile
                                        ? 'You have not posted any requests yet.'
                                        : `${customer.name} has no open requests.`}
                                </p>
                            )}
                            <ul className="space-y-3">
                                {requests.map((request) => (
                                    <li key={request.id}>
                                        <RequestCard request={request} scope={isOwnProfile ? 'mine' : 'all'} showAuthor={false} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {isOwnProfile && requestForm && (
                        <Modal show={creating} onClose={() => setCreating(false)} maxWidth="2xl">
                            <div className="p-6">
                                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Create a new request
                                </h3>
                                <RequestForm
                                    categories={requestForm.categories}
                                    limits={requestForm.limits}
                                    defaultCity={requestForm.defaultCity}
                                    inPanel
                                    onDone={() => setCreating(false)}
                                    onCancel={() => setCreating(false)}
                                />
                            </div>
                        </Modal>
                    )}

                    {/* Right: how technicians rate them */}
                    <section aria-label="Reviews" className={`${PANEL} w-full lg:w-72 lg:shrink-0 xl:w-1/4`}>
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
                                            {/* Anyone but its author can report it */}
                                            {review.technician.id !== auth.user.id && (
                                                <ReviewReportButton
                                                    action={route('customer-reviews.report', review.id)}
                                                    reasons={reportReasons}
                                                    authorName={review.technician.name}
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

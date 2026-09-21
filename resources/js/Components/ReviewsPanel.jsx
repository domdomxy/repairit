import Avatar from '@/Components/Avatar';
import { StarIcon } from '@/Components/Icons';
import { SIDE_PANEL } from '@/Components/ProfileParts';
import ReviewForm from '@/Components/ReviewForm';
import ReviewReportButton from '@/Components/ReviewReportButton';
import StarRating from '@/Components/StarRating';
import { Link } from '@inertiajs/react';
import { useState } from 'react';

/**
 * The right-hand panel of a profile: the rating summary (with how many reviews
 * gave each number of stars), the button that opens the review form, and the
 * reviews themselves. The same for technicians (reviewed by customers) and
 * customers (reviewed by technicians).
 *
 * reviews: [{ id, rating, comment, author: { id, name, avatar_url }, authorHref }]
 * canRespond: this viewer is someone who may review this profile (not its owner,
 *   and of the right role); canReview: they may do it now (they have talked).
 * formProps: passed on to ReviewForm (technicianId, or storeUrl and destroyUrl...).
 */
export default function ReviewsPanel({
    average,
    count,
    reviews,
    currentUserId,
    canRespond,
    canReview,
    lockedText,
    myReview,
    addLabel = 'Add review',
    editLabel = 'Edit your review',
    formTitle = 'Your review',
    formProps,
    reportRoute,
    reportReasons,
}) {
    // The form stays out of the way until asked for.
    const [formOpen, setFormOpen] = useState(false);

    const distribution = [5, 4, 3, 2, 1].map((stars) => ({
        stars,
        count: reviews.filter((review) => review.rating === stars).length,
    }));
    // Only when the list holds every review can the bars be trusted.
    const showDistribution = count > 0 && reviews.length === count;

    return (
        <section aria-label="Reviews" className={`${SIDE_PANEL} p-6`}>
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Reviews</h4>

            <div className="mt-4 flex items-center gap-4">
                <div className="shrink-0 text-center">
                    <p className="text-4xl font-semibold leading-none text-gray-900 dark:text-gray-100">
                        {count ? Number(average).toFixed(1) : '—'}
                    </p>
                    <div className="mt-2">
                        <StarRating value={count ? average : 0} className="h-3.5 w-3.5" />
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {count} review{count === 1 ? '' : 's'}
                    </p>
                </div>

                {showDistribution && (
                    <ul className="min-w-0 flex-1 space-y-1" aria-label="Reviews by number of stars">
                        {distribution.map(({ stars, count: n }) => (
                            <li key={stars} className="flex items-center gap-2 text-xs">
                                <span className="w-2 text-gray-500 dark:text-gray-400">{stars}</span>
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                                    <span
                                        className="block h-full rounded-full bg-amber-400"
                                        style={{ width: `${(n / count) * 100}%` }}
                                    />
                                </span>
                                <span className="w-4 text-end text-gray-500 dark:text-gray-400">{n}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {canRespond &&
                (canReview ? (
                    formOpen ? (
                        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {myReview ? formTitle : addLabel}
                                </h5>
                                <button
                                    type="button"
                                    onClick={() => setFormOpen(false)}
                                    className="text-xs text-gray-500 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    Cancel
                                </button>
                            </div>
                            <ReviewForm
                                key={myReview ? 'edit' : 'new'}
                                review={myReview}
                                onDone={() => setFormOpen(false)}
                                {...formProps}
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setFormOpen(true)}
                            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
                        >
                            <StarIcon className="h-4 w-4 text-amber-400" />
                            {myReview ? editLabel : addLabel}
                        </button>
                    )
                ) : (
                    <p className="mt-5 rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                        {lockedText}
                    </p>
                ))}

            <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
                {reviews.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet.</p>}

                <ul className="space-y-4">
                    {reviews.map((review) => (
                        <li key={review.id}>
                            <div className="flex items-start gap-3">
                                <Avatar user={review.author} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {review.authorHref ? (
                                            <Link href={review.authorHref} className="hover:underline">
                                                {review.author.name}
                                            </Link>
                                        ) : (
                                            review.author.name
                                        )}
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-1.5">
                                        <StarRating value={review.rating} className="h-3.5 w-3.5" />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {review.rating}/5
                                        </span>
                                    </div>
                                    {review.comment && (
                                        <p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                                            {review.comment}
                                        </p>
                                    )}
                                    {/* Anyone but its author can report it */}
                                    {review.author.id !== currentUserId && (
                                        <ReviewReportButton
                                            action={reportRoute(review.id)}
                                            reasons={reportReasons}
                                            authorName={review.author.name}
                                        />
                                    )}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}

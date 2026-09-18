import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';

const stars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export default function Index({ reviews, filters }) {
    const [q, setQ] = useState(filters.q ?? '');
    const [rating, setRating] = useState(filters.rating ?? '');

    function apply(next = {}) {
        const values = { q, rating, ...next };
        const query = Object.fromEntries(Object.entries(values).filter(([, value]) => value));

        router.get(route('admin.reviews.index'), query, { preserveState: true, replace: true });
    }

    function remove(review) {
        if (
            window.confirm(
                `Remove ${review.customer.name}'s review of ${review.technician.name}? Their rating will be recalculated.`,
            )
        ) {
            router.delete(route('admin.reviews.destroy', review.id), { preserveScroll: true });
        }
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Reviews</h2>}>
            <Head title="Reviews" />

            <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply();
                    }}
                    className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                >
                    <div className="min-w-[14rem] flex-1">
                        <label htmlFor="q" className="block text-xs font-medium text-gray-500">
                            Search comment, customer or technician
                        </label>
                        <input
                            id="q"
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                    </div>

                    <div>
                        <label htmlFor="rating" className="block text-xs font-medium text-gray-500">
                            Rating
                        </label>
                        <select
                            id="rating"
                            value={rating}
                            onChange={(e) => {
                                setRating(e.target.value);
                                apply({ rating: e.target.value });
                            }}
                            className="mt-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        >
                            <option value="">Any rating</option>
                            {[5, 4, 3, 2, 1].map((value) => (
                                <option key={value} value={value}>
                                    {value} star{value === 1 ? '' : 's'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        Search
                    </button>
                </form>

                {reviews.data.length === 0 && (
                    <p className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                        No reviews match these filters.
                    </p>
                )}

                {reviews.data.map((review) => (
                    <div key={review.id} className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="text-amber-500" aria-label={`${review.rating} out of 5`}>
                                    {stars(review.rating)}
                                </div>
                                <p className="mt-1 text-sm">
                                    <span className="font-medium">{review.customer.name}</span>
                                    <span className="text-gray-500"> reviewed </span>
                                    <span className="font-medium">{review.technician.name}</span>
                                    <span className="text-gray-500"> · {formatDate(review.created_at)}</span>
                                </p>
                                {review.comment ? (
                                    <p className="mt-2 whitespace-pre-line text-sm">{review.comment}</p>
                                ) : (
                                    <p className="mt-2 text-sm italic text-gray-400">No comment</p>
                                )}
                            </div>
                            <button
                                onClick={() => remove(review)}
                                className="shrink-0 text-sm text-red-600 hover:underline"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}

                <Pagination links={reviews.links} />
            </div>
        </AuthenticatedLayout>
    );
}

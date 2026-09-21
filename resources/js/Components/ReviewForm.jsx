import InputError from '@/Components/InputError';
import { StarIcon } from '@/Components/Icons';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

const COMMENT_LIMIT = 1000;

/**
 * Create or edit the signed-in person's review: a customer's review of a
 * technician (pass `technicianId`), or a technician's rating of a customer
 * (pass `storeUrl` and `destroyUrl`). Pass `review` ({ rating, comment }) to
 * edit an existing one. `onDone` runs once it has been saved or deleted (the
 * profile pages use it to fold the form away again).
 */
export default function ReviewForm({
    technicianId,
    review = null,
    storeUrl = null,
    destroyUrl = null,
    placeholder = 'Share how the job went (optional)',
    onDone = null,
}) {
    const { data, setData, post, processing, errors, recentlySuccessful } = useForm({
        rating: review?.rating ?? 0,
        comment: review?.comment ?? '',
    });
    const [hovered, setHovered] = useState(0);
    const shown = hovered || data.rating;

    function submit(e) {
        e.preventDefault();

        if (!data.rating) return;

        post(storeUrl ?? route('reviews.store', technicianId), {
            preserveScroll: true,
            onSuccess: () => onDone?.(),
        });
    }

    function remove() {
        if (!window.confirm('Delete your review?')) return;

        router.delete(destroyUrl ?? route('reviews.destroy', technicianId), {
            preserveScroll: true,
            onSuccess: () => onDone?.(),
        });
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <div>
                <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label="Rating"
                    onMouseLeave={() => setHovered(0)}
                >
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            type="button"
                            key={value}
                            onClick={() => setData('rating', value)}
                            onMouseEnter={() => setHovered(value)}
                            aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                            aria-pressed={data.rating === value}
                            className={`rounded p-0.5 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                                value <= shown
                                    ? 'text-amber-400'
                                    : 'text-gray-300 dark:text-gray-600'
                            }`}
                        >
                            <StarIcon className="h-7 w-7" />
                        </button>
                    ))}
                    {data.rating > 0 && (
                        <span className="ms-2 text-sm text-gray-600 dark:text-gray-400">
                            {data.rating}/5
                        </span>
                    )}
                </div>
                <InputError message={errors.rating} className="mt-1" />
            </div>

            <div>
                <textarea
                    rows={3}
                    maxLength={COMMENT_LIMIT}
                    value={data.comment}
                    onChange={(e) => setData('comment', e.target.value)}
                    placeholder={placeholder}
                    aria-label="Comment"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                />
                <InputError message={errors.comment} className="mt-1" />
            </div>

            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={processing || !data.rating}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {review ? 'Update review' : 'Submit review'}
                </button>

                {review && (
                    <button
                        type="button"
                        onClick={remove}
                        className="text-sm text-red-600 hover:underline dark:text-red-400"
                    >
                        Delete
                    </button>
                )}

                {recentlySuccessful && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">Saved.</span>
                )}
            </div>
        </form>
    );
}

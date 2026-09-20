import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import { router, useForm } from '@inertiajs/react';
import { useState } from 'react';

const COMMENT_LIMIT = 1000;

/**
 * Create or edit the signed-in person's review: a customer's review of a
 * technician (pass `technicianId`), or a technician's rating of a customer
 * (pass `storeUrl` and `destroyUrl`). Pass `review` ({ rating, comment }) to
 * edit an existing one.
 */
export default function ReviewForm({
    technicianId,
    review = null,
    storeUrl = null,
    destroyUrl = null,
    placeholder = 'Share how the job went (optional)',
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

        post(storeUrl ?? route('reviews.store', technicianId), { preserveScroll: true });
    }

    function remove() {
        if (!window.confirm('Delete your review?')) return;

        router.delete(destroyUrl ?? route('reviews.destroy', technicianId), { preserveScroll: true });
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
                            className={`text-3xl leading-none ${
                                value <= shown
                                    ? 'text-yellow-400'
                                    : 'text-gray-300 dark:text-gray-600'
                            }`}
                        >
                            ★
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
                <PrimaryButton disabled={processing || !data.rating}>
                    {review ? 'Update review' : 'Submit review'}
                </PrimaryButton>

                {review && (
                    <button
                        type="button"
                        onClick={remove}
                        className="text-sm text-red-600 underline dark:text-red-400"
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

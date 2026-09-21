import { StarIcon } from '@/Components/Icons';

// Five stars, `value` of them filled (rounded to the nearest whole star).
export default function StarRating({ value, className = 'h-4 w-4' }) {
    const filled = Math.round(Number(value) || 0);

    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${filled} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <StarIcon
                    key={n}
                    className={`${className} ${n <= filled ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
                />
            ))}
        </span>
    );
}

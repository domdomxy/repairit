import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';

const AVAILABILITY_DOT = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
};

// A short ranked list of the best rated technicians. `technicians` is already
// sorted; each entry links to the technician's profile. The optional category
// select narrows the ranking to technicians with an offer in that category;
// pass `categories`, `categoryValue` and `onCategoryChange` together to show it.
export default function TopRatedTechnicians({
    technicians,
    categories,
    categoryValue,
    onCategoryChange,
    className = '',
}) {
    return (
        <section className={`rounded-lg bg-white p-4 shadow dark:bg-gray-800 ${className}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold">Top rated technicians</h3>

                {categories && (
                    <select
                        aria-label="Filter top rated technicians by category"
                        value={categoryValue ?? ''}
                        onChange={(e) => onCategoryChange?.(e.target.value)}
                        className="rounded-md border-gray-300 py-1 text-xs dark:border-gray-600 dark:bg-gray-900"
                    >
                        <option value="">All categories</option>
                        {categories.map((category) => (
                            <option key={category.slug} value={category.slug}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {technicians.length === 0 ? (
                <p className="text-sm text-gray-500">No technician has been rated yet.</p>
            ) : (
                <ol className="space-y-1">
                    {technicians.map((technician, index) => (
                        <li key={technician.id}>
                            <Link
                                href={route('technicians.show', technician.id)}
                                className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <span className="w-4 shrink-0 text-center text-sm font-semibold text-gray-400">
                                    {index + 1}
                                </span>
                                <Avatar user={technician} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                        <span className="truncate">{technician.name}</span>
                                        <span
                                            className={`h-2 w-2 shrink-0 rounded-full ${
                                                AVAILABILITY_DOT[technician.availability_status] ?? 'bg-gray-400'
                                            }`}
                                            title={technician.availability_status}
                                        />
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        ⭐ {Number(technician.rating_avg).toFixed(2)} ({technician.rating_count})
                                        {technician.city && <> · {technician.city}</>}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

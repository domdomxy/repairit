import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { PinIcon, StarIcon } from '@/Components/Icons';

const AVAILABILITY_DOT = {
    available: 'bg-green-500',
    busy: 'bg-amber-500',
};

// Gold, silver and bronze for the podium; everyone after that just has a number.
const PODIUM = [
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'bg-slate-200 text-slate-600 dark:bg-slate-500/30 dark:text-slate-200',
    'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
];

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
            <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-500/10">
                    <StarIcon className="h-4 w-4" />
                </span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Top rated technicians</h3>
            </div>

            {categories && (
                <select
                    aria-label="Filter top rated technicians by category"
                    value={categoryValue ?? ''}
                    onChange={(e) => onCategoryChange?.(e.target.value)}
                    className="mt-3 block w-full rounded-lg border-gray-200 bg-gray-50 py-1.5 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
                >
                    <option value="">All categories</option>
                    {categories.map((category) => (
                        <option key={category.slug} value={category.slug}>
                            {category.name}
                        </option>
                    ))}
                </select>
            )}

            {technicians.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">No technician has been rated yet.</p>
            ) : (
                <ol className="mt-3 space-y-1">
                    {technicians.map((technician, index) => (
                        <li key={technician.id}>
                            <Link
                                href={route('technicians.show', technician.id)}
                                className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                                <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                                        PODIUM[index] ?? 'text-gray-400 dark:text-gray-500'
                                    }`}
                                >
                                    {index + 1}
                                </span>

                                <div className="relative shrink-0">
                                    <Avatar user={technician} size="md" />
                                    <span
                                        className={`absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-800 ${
                                            AVAILABILITY_DOT[technician.availability_status] ?? 'bg-gray-400'
                                        }`}
                                        title={technician.availability_status}
                                    />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {technician.name}
                                    </p>
                                    <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                        <StarIcon className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                                        <span className="font-medium text-gray-700 dark:text-gray-200">
                                            {Number(technician.rating_avg).toFixed(1)}
                                        </span>
                                        <span>({technician.rating_count})</span>
                                        {technician.city && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <PinIcon className="h-3 w-3 shrink-0" />
                                                <span className="truncate">{technician.city}</span>
                                            </>
                                        )}
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

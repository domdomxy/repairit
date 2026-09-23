import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { PinIcon, StarIcon } from '@/Components/Icons';
import { AVAILABILITY } from '@/lib/availability';

// A technician on the search page, as a compact card for a grid: a single link
// to their profile. Offers and requests are listed with the cards of the feed
// (OfferListing, RequestCard), so they look the same everywhere.

const CARD =
    'rounded-xl bg-white shadow ring-1 ring-transparent transition hover:shadow-md hover:ring-indigo-200 dark:bg-gray-800 dark:hover:ring-indigo-500';

// Up to three tags, and how many more there are.
function Tags({ categories, className = '' }) {
    if (!categories?.length) return null;

    const shown = categories.slice(0, 3);
    const hidden = categories.length - shown.length;
    const tag = 'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200';

    return (
        <div className={`flex flex-wrap gap-1 ${className}`}>
            {shown.map((category) => (
                <span key={category.id} className={tag}>
                    {category.name}
                </span>
            ))}
            {hidden > 0 && <span className={tag}>+{hidden}</span>}
        </div>
    );
}

function AvailabilityPill({ status }) {
    const availability = AVAILABILITY[status] ?? AVAILABILITY.offline;

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${availability.pill}`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${availability.dot}`} />
            {availability.label}
        </span>
    );
}

// "4.9 (12)", or a quiet "No reviews yet" for a technician nobody has rated.
function Rating({ average, count, className = '' }) {
    if (!Number(count)) {
        return <span className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>No reviews yet</span>;
    }

    return (
        <span className={`inline-flex items-center gap-1 text-sm ${className}`}>
            <StarIcon className="h-4 w-4 text-amber-400" />
            <span className="font-medium text-gray-900 dark:text-gray-100">{Number(average).toFixed(1)}</span>
            <span className="text-gray-500 dark:text-gray-400">({count})</span>
        </span>
    );
}

// A technician: who they are, how they are rated, whether they are free, what they fix.
export function TechnicianResult({ technician }) {
    const profile = technician.technician_profile;

    return (
        <Link
            href={route('technicians.show', technician.id)}
            className={`${CARD} flex h-full flex-col gap-3 p-4`}
        >
            <div className="flex items-start gap-3">
                <Avatar user={technician} size="lg" />

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-semibold text-gray-900 dark:text-gray-100">{technician.name}</h3>
                        {technician.is_favorite && (
                            <StarIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                        )}
                    </div>

                    {profile?.city && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-gray-500 dark:text-gray-400">
                            <PinIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{profile.city}</span>
                        </p>
                    )}

                    <Rating average={profile?.rating_avg} count={profile?.rating_count} className="mt-1" />
                </div>
            </div>

            <div className="flex items-center justify-between gap-2">
                <AvailabilityPill status={profile?.availability_status} />
                {technician.distance !== undefined && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Number(technician.distance).toFixed(1)} km away
                    </span>
                )}
            </div>

            <Tags categories={profile?.categories} className="mt-auto" />
        </Link>
    );
}

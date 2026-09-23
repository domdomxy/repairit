import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { PinIcon, StarIcon } from '@/Components/Icons';
import { OfferPrice } from '@/Components/OfferCard';
import PlayIcon from '@/Components/PlayIcon';
import { AVAILABILITY } from '@/lib/availability';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { linkify, POST_CARD_LINK_CLASS } from '@/lib/linkify';

// The three kinds of result on the search page, as compact cards for a grid.
// A card is a single link to what it is about (a technician's profile, one
// offer, one request): its title is a link stretched over the whole card, and
// anything else clickable on it (the technician behind an offer) sits above
// that link with `relative z-10`.

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

// The first picture or video of a post, cropped to a banner; a badge says how many more there are.
function Cover({ media }) {
    const first = media[0];

    return (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100 dark:bg-gray-900">
            {first.type === 'video' ? (
                <>
                    <video
                        src={`${first.url}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                    />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <PlayIcon className="h-10 w-10" />
                    </span>
                </>
            ) : (
                <img src={first.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            )}

            {media.length > 1 && (
                <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    +{media.length - 1}
                </span>
            )}
        </div>
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

// A technician's offer: a picture if it has one, the title and price, and the technician behind it.
export function OfferResult({ offer }) {
    const technician = offer.technician;

    return (
        <article className={`${CARD} relative flex h-full flex-col overflow-hidden`}>
            {offer.media?.length > 0 && <Cover media={offer.media} />}

            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 min-w-0 break-words font-semibold text-gray-900 dark:text-gray-100">
                        <Link href={route('offers.show', offer.id)} className="after:absolute after:inset-0">
                            {offer.title}
                        </Link>
                    </h3>
                    <OfferPrice price={offer.price} />
                </div>

                {offer.description && (
                    <p className="line-clamp-3 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
                        {linkify(offer.description, { linkClassName: POST_CARD_LINK_CLASS })}
                    </p>
                )}

                <Tags categories={offer.categories} className="mt-auto" />

                {/* Above the stretched link: the technician has a page of their own. */}
                <div className="relative z-10 flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                    <Link
                        href={route('technicians.show', technician.id)}
                        className="flex min-w-0 items-center gap-2 hover:opacity-80"
                    >
                        <Avatar user={technician} size="xs" />
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                {technician.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                {technician.city && <span className="truncate">{technician.city}</span>}
                                {Number(technician.rating_count) > 0 && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5">
                                        <StarIcon className="h-3 w-3 text-amber-400" />
                                        {Number(technician.rating_avg).toFixed(1)}
                                    </span>
                                )}
                            </span>
                        </span>
                    </Link>
                    <AvailabilityPill status={technician.availability_status} />
                </div>
            </div>
        </article>
    );
}

// A customer's repair request: what needs fixing, where, how many quotes it has.
// It carries the customer's name and picture like it does in the feed, and no more.
export function RequestResult({ request }) {
    return (
        <article className={`${CARD} relative flex h-full flex-col overflow-hidden`}>
            {request.media?.length > 0 && <Cover media={request.media} />}

            <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center gap-2 text-sm">
                    <Avatar user={request.customer} size="xs" />
                    <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">
                        {request.customer.name}
                    </span>
                    {request.city && (
                        <span className="flex min-w-0 shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400">
                            <PinIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{request.city}</span>
                        </span>
                    )}
                    <span
                        className="ms-auto shrink-0 text-xs text-gray-500 dark:text-gray-400"
                        title={formatDateTime(request.created_at)}
                    >
                        {relativeTime(request.created_at)}
                    </span>
                </div>

                {/* A request has no title: what the customer wrote is the post. */}
                <p className="line-clamp-4 whitespace-pre-line break-words text-gray-900 dark:text-gray-100">
                    {linkify(request.description, {
                        linkClassName: POST_CARD_LINK_CLASS,
                        renderText: (value) => (
                            <Link href={route('requests.show', request.id)} className="after:absolute after:inset-0">
                                {value}
                            </Link>
                        ),
                    })}
                </p>

                <Tags categories={request.categories} className="mt-auto" />

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    <span className="flex items-center gap-2">
                        {request.quotes_count} quote{request.quotes_count === 1 ? '' : 's'}
                        {request.has_my_quote && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                You sent a quote
                            </span>
                        )}
                    </span>
                    {request.budget && (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                            Budget: {request.budget}
                        </span>
                    )}
                </div>
            </div>
        </article>
    );
}

import Avatar from '@/Components/Avatar';
import FeedKindBadge from '@/Components/FeedKindBadge';
import OfferCard, { OfferPrice } from '@/Components/OfferCard';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import { formatDateTime, formatMessageTime, relativeTime } from '@/lib/dates';
import { Link } from '@inertiajs/react';

const AVAILABILITY_STYLES = {
    available: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    busy: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

// Who the offer belongs to: the top of every card, with the offer's menu at the
// top right. Like a request's header: the name with the city and rating beside
// it, and when it was posted underneath.
function TechnicianHeader({ technician, createdAt, menu, showKind }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <Link
                href={route('technicians.show', technician.id)}
                className="flex min-w-0 items-center gap-3 hover:opacity-80"
            >
                <Avatar user={technician} size="md" />
                <div className="min-w-0">
                    <p className="flex min-w-0 items-baseline gap-1.5">
                        <span className="truncate font-semibold">{technician.name}</span>
                        {technician.city && (
                            <span className="truncate text-sm text-gray-500">· {technician.city}</span>
                        )}
                        <span className="shrink-0 text-sm text-gray-500">
                            · ⭐ {technician.rating_avg ?? '—'} ({technician.rating_count ?? 0})
                        </span>
                    </p>
                    {createdAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400" title={formatDateTime(createdAt)}>
                            {formatMessageTime(createdAt)} · {relativeTime(createdAt)}
                        </p>
                    )}
                </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
                {showKind && <FeedKindBadge kind="offer" />}
                <span
                    className={`rounded-full px-2 py-1 text-xs capitalize ${
                        AVAILABILITY_STYLES[technician.availability_status] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                >
                    {technician.availability_status}
                </span>
                {menu}
            </div>
        </div>
    );
}

// An offer as it is listed for customers: the technician behind it, the offer
// itself, and what can be done with it: send it in the chat, or copy its link
// or report it from the menu. The price sits with the actions at the bottom.
// `offer.technician` is the public card the server sends with each offer.
// In the feed, `showKind` marks it as an offer among the requests, and
// `onEdit` / `onDelete` let its technician manage it from the menu.
// On the offer's own page (`detail`) it is the same card, with the description in
// full and no highlight when the mouse is over it.
export default function OfferListing({ offer, reportReasons, showKind = false, detail = false, onEdit, onDelete }) {
    return (
        <div
            className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10 ${
                detail ? '' : 'transition hover:ring-indigo-300 dark:hover:ring-indigo-500'
            }`}
        >
            <OfferCard
                offer={offer}
                listing
                fullText={detail}
                className="space-y-3"
                header={
                    <TechnicianHeader
                        technician={offer.technician}
                        createdAt={offer.created_at}
                        menu={<OfferMenu offer={offer} reasons={reportReasons} onEdit={onEdit} onDelete={onDelete} />}
                        showKind={showKind}
                    />
                }
            >
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <OfferShareActions offer={offer} technicianId={offer.technician.id} showCopy={false} />
                        <Link
                            href={route('technicians.show', offer.technician.id)}
                            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                        >
                            View profile
                        </Link>
                    </div>
                    <OfferPrice price={offer.price} />
                </div>
            </OfferCard>
        </div>
    );
}

import Avatar from '@/Components/Avatar';
import FeedKindBadge from '@/Components/FeedKindBadge';
import OfferCard, { OfferPrice } from '@/Components/OfferCard';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import { Link } from '@inertiajs/react';

const AVAILABILITY_STYLES = {
    available: 'bg-green-100 text-green-700',
    busy: 'bg-yellow-100 text-yellow-700',
};

// Who the offer belongs to: the top of every card, with the offer's menu at the
// top right.
function TechnicianHeader({ technician, menu, showKind }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <Link
                href={route('technicians.show', technician.id)}
                className="flex min-w-0 items-center gap-3 hover:opacity-80"
            >
                <Avatar user={technician} size="md" />
                <div className="min-w-0">
                    <p className="truncate font-semibold">{technician.name}</p>
                    <p className="truncate text-sm text-gray-500">
                        {technician.city && <>{technician.city} · </>}⭐ {technician.rating_avg ?? '—'} ({technician.rating_count ?? 0})
                    </p>
                </div>
            </Link>
            <div className="flex shrink-0 items-center gap-2">
                {showKind && <FeedKindBadge kind="offer" />}
                <span
                    className={`rounded-full px-2 py-1 text-xs capitalize ${
                        AVAILABILITY_STYLES[technician.availability_status] ?? 'bg-gray-100 text-gray-600'
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
// In the feed, `showKind` marks it as an offer among the requests.
export default function OfferListing({ offer, reportReasons, showKind = false }) {
    return (
        <div className="rounded-md bg-white dark:bg-gray-800">
            <OfferCard
                offer={offer}
                listing
                header={
                    <TechnicianHeader
                        technician={offer.technician}
                        menu={<OfferMenu offer={offer} reasons={reportReasons} />}
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

import Avatar from '@/Components/Avatar';
import OfferCard from '@/Components/OfferCard';
import OfferShareActions from '@/Components/OfferShareActions';
import { Link } from '@inertiajs/react';

const AVAILABILITY_STYLES = {
    available: 'bg-green-100 text-green-700',
    busy: 'bg-yellow-100 text-yellow-700',
};

// Who the offer belongs to: the top of every card.
function TechnicianHeader({ technician }) {
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
            <span
                className={`shrink-0 rounded-full px-2 py-1 text-xs capitalize ${
                    AVAILABILITY_STYLES[technician.availability_status] ?? 'bg-gray-100 text-gray-600'
                }`}
            >
                {technician.availability_status}
            </span>
        </div>
    );
}

// An offer as it is listed for customers: the technician behind it, the offer
// itself, and what can be done with it (send it in the chat, copy its link).
// `offer.technician` is the public card the server sends with each offer.
export default function OfferListing({ offer }) {
    return (
        <div className="rounded-md bg-white dark:bg-gray-800">
            <OfferCard offer={offer} header={<TechnicianHeader technician={offer.technician} />}>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <OfferShareActions offer={offer} technicianId={offer.technician.id} />
                    <Link
                        href={route('technicians.show', offer.technician.id)}
                        className="text-sm text-indigo-600 underline dark:text-indigo-400"
                    >
                        View profile
                    </Link>
                </div>
            </OfferCard>
        </div>
    );
}

import { Link } from '@inertiajs/react';

// An offer sent in the chat, as a card that opens the offer. If the technician
// has deleted the offer since, only its title is left.
export default function SharedOfferCard({ offer, onImageLoad }) {
    if (!offer.url) {
        return (
            <div className="w-64 max-w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                <p className="italic">This offer is no longer available</p>
                <p className="mt-1 truncate">{offer.title}</p>
            </div>
        );
    }

    return (
        <Link
            href={offer.url}
            className="block w-64 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:shadow dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
            {offer.image_url && (
                <img src={offer.image_url} alt="" loading="lazy" onLoad={onImageLoad} className="h-32 w-full object-cover" />
            )}
            <div className="space-y-0.5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Offer</p>
                <p className="truncate font-medium">{offer.title}</p>
                {offer.price && <p className="text-sm text-indigo-600 dark:text-indigo-300">{offer.price}</p>}
                <p className="pt-1 text-xs text-indigo-600 dark:text-indigo-400">View offer →</p>
            </div>
        </Link>
    );
}

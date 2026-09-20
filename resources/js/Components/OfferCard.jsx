import OfferMediaGrid from '@/Components/OfferMediaGrid';

// One offer as customers see it. `children` is a slot for actions (edit,
// delete) so the technician's own list can reuse the same card.
export default function OfferCard({ offer, children }) {
    return (
        <div className="space-y-3 rounded-md border p-4 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
                <h5 className="min-w-0 break-words font-medium">{offer.title}</h5>
                {offer.price && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                        {offer.price}
                    </span>
                )}
            </div>

            {offer.description && (
                <p className="whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
                    {offer.description}
                </p>
            )}

            <OfferMediaGrid media={offer.media} />

            {children}
        </div>
    );
}

const LABELS = {
    request: 'Request',
    offer: 'Offer',
};

// Says what a post in the feed is: a customer's repair request or a
// technician's offer. A plain, uncolored tag — no background fill, no
// per-kind color, just a neutral outline and text.
export default function FeedKindBadge({ kind }) {
    const label = LABELS[kind];

    if (!label) return null;

    return (
        <span className="inline-block shrink-0 rounded-full border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:text-gray-300">
            {label}
        </span>
    );
}

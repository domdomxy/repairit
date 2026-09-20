const STYLES = {
    request: {
        label: 'Request',
        classes: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
    },
    offer: {
        label: 'Offer',
        classes: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-200',
    },
};

// Says what a post in the feed is: a customer's repair request or a
// technician's offer.
export default function FeedKindBadge({ kind }) {
    const style = STYLES[kind];

    if (!style) return null;

    return <span className={`rounded-full px-2 py-1 text-xs font-medium ${style.classes}`}>{style.label}</span>;
}

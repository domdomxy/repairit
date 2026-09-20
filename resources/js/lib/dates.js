export function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString() : '';
}

export function formatDateTime(iso) {
    return iso ? new Date(iso).toLocaleString() : '';
}

/**
 * "Sep 19" for a plain `YYYY-MM-DD` date, as the chart data uses. Built from
 * its parts, not parsed as an ISO string, so no time zone can shift it a day.
 */
export function formatShortDate(ymd) {
    const [year, month, day] = ymd.split('-').map(Number);

    return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "just now", "5m ago", "3h ago", "2d ago" - for lists where the exact time doesn't matter. */
export function relativeTime(iso) {
    const seconds = (Date.now() - new Date(iso).getTime()) / 1000;

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return `${Math.floor(seconds / 86400)}d ago`;
}

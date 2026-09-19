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

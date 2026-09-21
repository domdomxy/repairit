export function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString() : '';
}

export function formatDateTime(iso) {
    return iso ? new Date(iso).toLocaleString() : '';
}

/** "14:32" for today's messages, "Sep 19, 14:32" for older ones (in the viewer's own format and time zone). */
export function formatMessageTime(iso) {
    if (!iso) return '';

    const date = new Date(iso);
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (date.toDateString() === new Date().toDateString()) return time;

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
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

// A pause this long between two messages (or a new calendar day) is marked
// with a centred time label in the conversation.
export const CHAT_GAP_MS = 60 * 60 * 1000;

export function needsChatSeparator(previousIso, iso) {
    if (!previousIso) return true;

    const previous = new Date(previousIso);
    const current = new Date(iso);

    return current - previous >= CHAT_GAP_MS || previous.toDateString() !== current.toDateString();
}

/**
 * The label above a group of messages, like Instagram's: "11:59 AM" today,
 * "Yesterday 11:59 AM", "Wed 11:59 AM" within the last week, then
 * "Sep 3, 11:59 AM" (with the year when it isn't this one).
 */
export function formatChatSeparator(iso) {
    const date = new Date(iso);
    const now = new Date();
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

    if (daysAgo <= 0) return time;
    if (daysAgo === 1) return `Yesterday ${time}`;
    if (daysAgo < 7) return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`;

    const day = date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });

    return `${day}, ${time}`;
}

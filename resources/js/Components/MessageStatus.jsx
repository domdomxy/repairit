import { relativeTime } from '@/lib/dates';

// A single check means the message reached the server ("Delivered"); a
// second check, plus how long ago, means the other person opened the
// conversation and it was marked read ("Seen 5m ago"). Shown only on the
// last message we sent - "View details" on any other one has the same
// information (see MessageDetailsModal), so callers only render this when
// that message is the last in the conversation.
//
// `compact`: the small tick-only icon used inline in a conversation list row.
export default function MessageStatus({ seen, readAt, compact = false }) {
    const icon = (
        <svg
            viewBox="0 0 20 12"
            width={compact ? 14 : 12}
            height={compact ? 8.4 : 7.2}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M1 6.5 4.5 10 11 2" />
            {seen && <path d="M8.5 6.5 12 10 18.5 2" />}
        </svg>
    );

    if (compact) {
        return (
            <span
                title={seen ? 'Seen' : 'Delivered'}
                aria-label={seen ? 'Seen' : 'Delivered'}
                className={`inline-flex shrink-0 self-center ${
                    seen ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
                }`}
            >
                {icon}
            </span>
        );
    }

    return (
        <p
            title={seen && readAt ? formatSeenTitle(readAt) : undefined}
            className={`mt-0.5 flex items-center gap-1 px-1 text-[11px] ${
                seen ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
            }`}
        >
            {icon}
            {seen ? `Seen ${relativeTime(readAt)}` : 'Delivered'}
        </p>
    );
}

function formatSeenTitle(iso) {
    return `Seen ${new Date(iso).toLocaleString()}`;
}

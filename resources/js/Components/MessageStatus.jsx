// A single check means the message reached the server ("Delivered"); a
// second check fades in once the other person has opened the conversation
// and it was marked read ("Seen"). Shown only on messages we sent.
//
// `compact`: for a conversation list row, where it sits inline with a preview
// line and should always show, unlike the chat bubble's hover-revealed one.
export default function MessageStatus({ seen, compact = false }) {
    return (
        <span
            title={seen ? 'Seen' : 'Delivered'}
            aria-label={seen ? 'Seen' : 'Delivered'}
            className={`shrink-0 self-center ${compact ? 'inline-flex' : 'hidden sm:block'} ${
                seen ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
            }`}
        >
            <svg
                viewBox="0 0 20 12"
                width={compact ? 14 : 16}
                height={compact ? 8.4 : 10}
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
        </span>
    );
}

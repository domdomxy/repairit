import { PushpinIcon, XIcon } from '@/Components/Icons';

// One short line describing a pinned message, in the reader's own words -
// mirrors what the server's Message::preview() shows in a conversation list,
// but computed here since a pin can flip live without a full page reload.
// Exported so PinnedMessagesModal can render the exact same summary.
export function summarize(message) {
    if (message.body) return message.body;
    if (message.offer) return `Shared an offer: ${message.offer.title}`;
    if (message.request) return 'Shared a request';
    if (message.quote) return `Sent a quote: ${message.quote.price}`;
    if (message.location) return 'Shared a location';

    const count = message.attachments?.length ?? 0;
    if (count > 0) return count === 1 ? 'Sent an attachment' : `Sent ${count} attachments`;

    return 'Message';
}

export default function PinnedMessagesBar({ messages, myId, onJump, onUnpin, onViewAll }) {
    if (messages.length === 0) return null;

    // Most recently pinned first.
    const pinned = [...messages].sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));

    return (
        <div className="border-b border-gray-100 bg-indigo-50/60 dark:border-gray-700 dark:bg-indigo-950/20">
            {onViewAll && (
                <button
                    type="button"
                    onClick={onViewAll}
                    className="flex w-full items-center gap-2 border-b border-indigo-100 px-4 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                >
                    <PushpinIcon className="h-3.5 w-3.5 shrink-0" />
                    {pinned.length === 1 ? '1 pinned message' : `${pinned.length} pinned messages`}
                    <span className="ms-auto text-indigo-500 dark:text-indigo-400">View all</span>
                </button>
            )}
            <div className="max-h-40 overflow-y-auto">
            {pinned.map((message) => (
                <div
                    key={message.id}
                    className="flex items-center gap-2 border-b border-indigo-100 px-4 py-2 last:border-b-0 dark:border-indigo-900/40"
                >
                    <PushpinIcon className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                    <button
                        type="button"
                        onClick={() => onJump(message.id)}
                        className="min-w-0 flex-1 text-start"
                    >
                        <span className="block truncate text-xs font-medium text-indigo-700 dark:text-indigo-300">
                            {message.sender_id === myId ? 'You' : message.sender_name}
                        </span>
                        <span className="block truncate text-xs text-gray-600 dark:text-gray-400">
                            {summarize(message)}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onUnpin(message.id)}
                        aria-label="Unpin message"
                        title="Unpin message"
                        className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200/60 hover:text-gray-600 dark:hover:bg-gray-700/60 dark:hover:text-gray-300"
                    >
                        <XIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            ))}
            </div>
        </div>
    );
}

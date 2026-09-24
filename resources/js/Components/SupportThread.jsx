import Avatar from '@/Components/Avatar';
import MediaLightbox from '@/Components/MediaLightbox';
import { formatDateTime } from '@/lib/dates';
import { linkify } from '@/lib/linkify';
import { useState } from 'react';

// The conversation on a ticket. Messages from the viewer's own side sit on the
// right, like the chat page, so it is clear at a glance who said what.
// Messages this close together, from the same person and of the same kind
// (written or automatic), read as one stack under a single name.
const STACK_GAP_MS = 5 * 60 * 1000;

function continuesStack(message, previous) {
    return (
        previous !== undefined &&
        previous.from_staff === message.from_staff &&
        previous.author === message.author &&
        Boolean(previous.automated) === Boolean(message.automated) &&
        new Date(message.created_at) - new Date(previous.created_at) <= STACK_GAP_MS
    );
}

export default function SupportThread({ thread, viewerIsStaff }) {
    // The pictures of one message being looked at full size: { items, index }.
    const [viewing, setViewing] = useState(null);

    return (
        <>
            <ul>
                {thread.map((message, position) => {
                    const mine = message.from_staff === viewerIsStaff;
                    // Only the first message of a stack carries the name and the avatar.
                    const stacked = continuesStack(message, thread[position - 1]);

                    return (
                        <li
                            key={message.id}
                            className={`flex items-start gap-2 ${stacked ? 'mt-1' : position === 0 ? '' : 'mt-4'} ${
                                mine ? 'justify-end' : 'justify-start'
                            }`}
                        >
                            {!mine &&
                                (stacked ? (
                                    <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                                ) : (
                                    <Avatar src={message.avatar_url} name={message.author} size="sm" />
                                ))}
                            <div className={`flex min-w-0 max-w-2xl flex-col ${mine ? 'items-end' : 'items-start'}`}>
                                {/* Who wrote it sits above the bubble; an automatic message says so beside the name. */}
                                {!stacked && (
                                    <p className="mb-1 px-1 text-xs text-gray-500 dark:text-gray-400">
                                        {message.author}
                                        {message.automated && ' (Automatic reply)'}
                                    </p>
                                )}
                                <div
                                    className={`max-w-full rounded-2xl px-4 py-3 ${
                                        mine
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10'
                                    }`}
                                >
                                    {/* whitespace-pre-line keeps the writer's line breaks; React escapes the text itself. */}
                                    {message.body && (
                                        <p className="whitespace-pre-line break-words text-sm">
                                            {linkify(message.body, {
                                                linkClassName: mine
                                                    ? 'break-all underline hover:text-indigo-100'
                                                    : 'break-all text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200',
                                            })}
                                        </p>
                                    )}
                                    {message.attachments?.length > 0 && (
                                        <div
                                            className={`grid gap-1.5 ${message.body ? 'mt-3' : ''} ${
                                                message.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                                            }`}
                                        >
                                            {message.attachments.map((attachment, index) => (
                                                <button
                                                    key={attachment.id}
                                                    type="button"
                                                    onClick={() => setViewing({ items: message.attachments, index })}
                                                    aria-label={`View ${attachment.name}`}
                                                    className="block overflow-hidden rounded-lg"
                                                >
                                                    <img
                                                        src={attachment.url}
                                                        alt={attachment.name}
                                                        loading="lazy"
                                                        className={
                                                            message.attachments.length > 1
                                                                ? 'h-32 w-full object-cover'
                                                                : 'max-h-64 w-auto max-w-full rounded-lg object-contain'
                                                        }
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <p
                                        className={`mt-1.5 text-end text-[11px] ${mine ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}
                                    >
                                        {formatDateTime(message.created_at)}
                                    </p>
                                </div>
                            </div>
                            {mine &&
                                (stacked ? (
                                    <span className="h-8 w-8 shrink-0" aria-hidden="true" />
                                ) : (
                                    <Avatar src={message.avatar_url} name={message.author} size="sm" />
                                ))}
                        </li>
                    );
                })}
            </ul>

            {viewing && (
                <MediaLightbox
                    attachments={viewing.items}
                    index={viewing.index}
                    onIndexChange={(index) => setViewing({ ...viewing, index })}
                    onClose={() => setViewing(null)}
                />
            )}
        </>
    );
}

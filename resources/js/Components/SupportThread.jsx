import Avatar from '@/Components/Avatar';
import MediaLightbox from '@/Components/MediaLightbox';
import TypingIndicator from '@/Components/TypingIndicator';
import { formatChatSeparator, formatDateTime, needsChatSeparator } from '@/lib/dates';
import { linkify } from '@/lib/linkify';
import { Fragment, useEffect, useRef, useState } from 'react';

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

// The thread is part of the page, not a box that scrolls. The end of it counts
// as "just below the screen" when it has slipped a little past the bottom edge
// (a new message or the typing bubble pushed it there): that is the one case
// worth scrolling for. Anywhere else the reader is left exactly where they are.
const JUST_BELOW_PX = 240;

function isJustBelowView(element) {
    const top = element.getBoundingClientRect().top;

    return top > window.innerHeight && top - window.innerHeight < JUST_BELOW_PX;
}

/**
 * `firstUnreadId` is the oldest message the viewer had not read when the page
 * opened (a "New messages" line goes above it). `typing`, with `typingAuthor`
 * (anything with a name and an avatar_url), shows the other side's typing bubble.
 */
export default function SupportThread({ thread, viewerIsStaff, firstUnreadId = null, typing = false, typingAuthor = null }) {
    // The pictures of one message being looked at full size: { items, index }.
    const [viewing, setViewing] = useState(null);
    const unreadDivider = useRef(null);
    const end = useRef(null);
    const seenLength = useRef(thread.length);

    // Opening a ticket with something new in it lands on the "New messages"
    // line. Deferred a frame so it runs after the page has settled in place.
    useEffect(() => {
        if (firstUnreadId == null) return undefined;

        const frame = requestAnimationFrame(() => unreadDivider.current?.scrollIntoView({ block: 'center' }));

        return () => cancelAnimationFrame(frame);
        // Only when the page opens: the line doesn't chase messages that arrive later.
    }, []);

    // A message arriving (or being sent) or the other side starting to type
    // brings the end into view when it landed just below the screen, so the
    // newest thing is never cut off. Someone reading further up, or typing a
    // reply, isn't moved.
    useEffect(() => {
        const grew = thread.length !== seenLength.current;
        seenLength.current = thread.length;

        if ((grew || typing) && end.current && isJustBelowView(end.current)) {
            end.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [thread.length, typing]);

    return (
        <>
            {/* One block, so the page's own spacing between sections doesn't open gaps inside the thread. */}
            <div>
                <ul>
                    {thread.map((message, position) => {
                        const mine = message.from_staff === viewerIsStaff;
                        const previous = thread[position - 1];
                        // A long pause or a new day is marked with a time label above the message that follows it.
                        const separator = needsChatSeparator(previous?.created_at, message.created_at)
                            ? formatChatSeparator(message.created_at)
                            : null;
                        const hasUnreadDivider = firstUnreadId != null && message.id === firstUnreadId;
                        // Only the first message of a stack carries the name and the avatar,
                        // and a label or the "New messages" line always starts a new one.
                        const stacked = !separator && !hasUnreadDivider && continuesStack(message, previous);

                        return (
                            <Fragment key={message.id}>
                                {separator && (
                                    <li className={`py-2 text-center text-xs text-gray-400 dark:text-gray-500 ${position === 0 ? '' : 'mt-4'}`}>
                                        {separator}
                                    </li>
                                )}
                                {hasUnreadDivider && (
                                    <li
                                        ref={unreadDivider}
                                        role="separator"
                                        aria-label="New messages"
                                        className={`flex items-center gap-3 py-1 ${position === 0 && !separator ? '' : 'mt-2'}`}
                                    >
                                        <span className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                                        <span className="shrink-0 text-xs font-medium text-indigo-500 dark:text-indigo-400">
                                            New messages
                                        </span>
                                        <span className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                                    </li>
                                )}
                                <li
                                    className={`flex items-start gap-2 ${
                                        separator || hasUnreadDivider ? 'mt-2' : stacked ? 'mt-1' : position === 0 ? '' : 'mt-4'
                                    } ${mine ? 'justify-end' : 'justify-start'}`}
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
                            </Fragment>
                        );
                    })}
                </ul>

                {typing && typingAuthor && (
                    <div className={thread.length > 0 ? 'mt-4' : ''}>
                        <TypingIndicator
                            author={typingAuthor}
                            bubbleClassName="rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10"
                        />
                    </div>
                )}
                <div ref={end} />
            </div>

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

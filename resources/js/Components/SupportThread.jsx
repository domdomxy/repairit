import Avatar from '@/Components/Avatar';
import MediaLightbox from '@/Components/MediaLightbox';
import MediaStackThumb, { stackFan } from '@/Components/MediaStackThumb';
import TypingIndicator from '@/Components/TypingIndicator';
import { formatChatSeparator, formatDateTime, needsChatSeparator } from '@/lib/dates';
import { linkify } from '@/lib/linkify';
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

// The thread scrolls inside the conversation card (`scrollRef`), and stays glued
// to the newest message while the reader is at (or near) the bottom of it: a
// message arriving, the typing bubble or a picture finishing loading all push the
// end down, and the view follows. A reader who scrolled up to look at something
// older is left exactly where they are.
const STICK_WITHIN_PX = 120;

/**
 * `firstUnreadId` is the oldest message the viewer had not read when the page
 * opened (a "New messages" line goes above it). `typing`, with `typingAuthor`
 * (anything with a name and an avatar_url), shows the other side's typing bubble.
 * `scrollRef` is the element that scrolls (the card's message area).
 */
export default function SupportThread({
    thread,
    viewerIsStaff,
    firstUnreadId = null,
    typing = false,
    typingAuthor = null,
    scrollRef,
}) {
    // The pictures of one message being looked at full size: { items, index }.
    const [viewing, setViewing] = useState(null);
    const unreadDivider = useRef(null);
    const content = useRef(null);
    const stuck = useRef(true);
    const seenLength = useRef(thread.length);

    function scrollToEnd() {
        const scroller = scrollRef.current;

        if (scroller) scroller.scrollTop = scroller.scrollHeight;
    }

    // Opening a ticket lands on the "New messages" line when there is something
    // unread, on the newest message otherwise. Runs before the first paint so
    // the page never shows the top of the thread first.
    useLayoutEffect(() => {
        const scroller = scrollRef.current;
        const divider = unreadDivider.current;

        if (!scroller) return;

        if (firstUnreadId != null && divider) {
            const box = scroller.getBoundingClientRect();
            const line = divider.getBoundingClientRect();

            stuck.current = false;
            scroller.scrollTop += line.top - box.top - (box.height / 2 - line.height / 2);
        } else {
            scrollToEnd();
        }
        // Only when the page opens: the line doesn't chase messages that arrive later.
    }, []);

    // Follow the end of the thread while the reader is at the bottom of it.
    useEffect(() => {
        const scroller = scrollRef.current;

        if (!scroller || !content.current) return undefined;

        const onScroll = () => {
            stuck.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < STICK_WITHIN_PX;
        };
        const observer = new ResizeObserver(() => {
            if (stuck.current) scrollToEnd();
        });

        scroller.addEventListener('scroll', onScroll, { passive: true });
        observer.observe(content.current);

        return () => {
            scroller.removeEventListener('scroll', onScroll);
            observer.disconnect();
        };
    }, []);

    // Sending a message always brings it into view, wherever the reader was.
    useEffect(() => {
        const grew = thread.length > seenLength.current;
        seenLength.current = thread.length;

        if (grew && thread[thread.length - 1]?.from_staff === viewerIsStaff) {
            stuck.current = true;
            scrollToEnd();
        }
    }, [thread.length]);

    return (
        <>
            {/* One block, so the page's own spacing between sections doesn't open gaps inside the thread. */}
            <div ref={content}>
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
                        // Several pictures on one message are shown as a stack, one is shown as itself.
                        const attachments = message.attachments ?? [];
                        const stackedFiles = attachments.length > 1;
                        const fan = stackFan(attachments.length);

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
                                        {/* Written text (or a single picture) sits in a bubble; several pictures fan out as one stack below it. */}
                                        {(message.body || !stackedFiles) && (
                                            <div
                                                className={`max-w-full rounded-2xl px-4 py-3 ${
                                                    mine
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 dark:bg-gray-700'
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
                                                {attachments.length === 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setViewing({ items: attachments, index: 0 })}
                                                        aria-label={`View ${attachments[0].name}`}
                                                        className={`block overflow-hidden rounded-lg ${message.body ? 'mt-3' : ''}`}
                                                    >
                                                        <img
                                                            src={attachments[0].url}
                                                            alt={attachments[0].name}
                                                            loading="lazy"
                                                            className="max-h-64 w-auto max-w-full rounded-lg object-contain"
                                                        />
                                                    </button>
                                                )}
                                                <p
                                                    className={`mt-1.5 text-end text-[11px] ${mine ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}
                                                >
                                                    {formatDateTime(message.created_at)}
                                                </p>
                                            </div>
                                        )}
                                        {stackedFiles && (
                                            <div
                                                className={`flex flex-col ${message.body ? 'mt-2' : ''} ${mine ? 'items-end' : 'items-start'}`}
                                                // The fan reaches up and to the right: keep it inside the column when the stack sits on the right.
                                                style={mine ? { marginRight: fan } : undefined}
                                            >
                                                {/* The thumbnails fan out upward, so leave them room above the caption. */}
                                                <p className="relative z-20 text-xs text-gray-500 dark:text-gray-400" style={{ marginBottom: fan + 8 }}>
                                                    {mine ? 'You' : message.author} sent {attachments.length} attachments
                                                </p>
                                                <MediaStackThumb attachments={attachments} onOpen={() => setViewing({ items: attachments, index: 0 })} />
                                                {/* A stack with no text has no bubble to carry the time. */}
                                                {!message.body && (
                                                    <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">{formatDateTime(message.created_at)}</p>
                                                )}
                                            </div>
                                        )}
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
                            bubbleClassName="rounded-2xl bg-gray-100 dark:bg-gray-700"
                        />
                    </div>
                )}
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

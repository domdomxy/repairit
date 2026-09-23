import Avatar from '@/Components/Avatar';
import { PushpinIcon } from '@/Components/Icons';
import MessageAttachments from '@/Components/MessageAttachments';
import MessageDetailsModal from '@/Components/MessageDetailsModal';
import MessageStatus from '@/Components/MessageStatus';
import Modal from '@/Components/Modal';
import ReportModal from '@/Components/ReportModal';
import SharedLocationCard from '@/Components/SharedLocationCard';
import SharedOfferCard from '@/Components/SharedOfferCard';
import SharedQuoteCard from '@/Components/SharedQuoteCard';
import SharedRequestCard from '@/Components/SharedRequestCard';
import { formatDateTime, formatMessageTime } from '@/lib/dates';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';

// How far a swipe must travel before releasing it counts as "reply", and the
// most it can drag (with resistance built in via the clamp, not eased).
const REPLY_THRESHOLD = 56;
const REPLY_MAX_DRAG = 88;

function ReplyIcon({ className = 'h-4 w-4' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 17 4 12l5-5" />
            <path d="M4 12h10a6 6 0 0 1 6 6v1" />
        </svg>
    );
}

// Scrolls a message back into view and briefly highlights it, used when a
// reply's quoted line is clicked.
function jumpToMessage(id) {
    const el = document.getElementById(`message-${id}`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-400', 'rounded-lg');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'rounded-lg'), 1200);
}

// The panel opened by "Unsend": which of the two scopes to unsend in, laid
// out as a plain list of options (like the ⋯ menu itself) rather than a pair
// of action buttons, since neither choice is more "primary" than the other.
function UnsendPanel({ show, onClose, onChoose }) {
    const row = 'block w-full px-4 py-3 text-start text-sm hover:bg-gray-50 dark:hover:bg-gray-700';

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="px-4 pb-1 pt-4">
                <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Unsend this message?</h2>
            </div>
            <div className="mt-2 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                <button type="button" onClick={() => onChoose('everyone')} className={`${row} text-red-600 dark:text-red-400`}>
                    Unsend for everyone
                </button>
                <button type="button" onClick={() => onChoose('me')} className={`${row} text-gray-700 dark:text-gray-300`}>
                    Unsend for me
                </button>
                <button type="button" onClick={onClose} className={`${row} text-gray-500 dark:text-gray-400`}>
                    Cancel
                </button>
            </div>
        </Modal>
    );
}

function highlightText(text, query) {
    if (!query) return text;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length === 1) return text;

    return parts.map((part, index) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="rounded bg-yellow-300 px-0.5 text-gray-900 dark:bg-yellow-500">
                {part}
            </mark>
        ) : (
            part
        ),
    );
}

// One message in the conversation, with what its owner can do to it: edit it
// or unsend it (for me / for everyone) when it is theirs, delete it for
// themselves or report it when it is the other person's.
export default function MessageRow({
    message,
    isMine,
    author,
    myId,
    otherName,
    reported,
    reasons,
    onMessagesChange,
    onImageLoad,
    onReply,
    onEdit,
    isLast,
    highlight,
}) {
    const [reporting, setReporting] = useState(false);
    const [viewingDetails, setViewingDetails] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Tracked in refs, not state, so the move/up handlers always see the
    // latest value without waiting on a render.
    const dragState = useRef({ pointerId: null, startX: 0, startY: 0, active: false, dx: 0 });
    const canReply = typeof onReply === 'function' && !message.deleted;

    function onDragStart(e) {
        if (!canReply || e.pointerType === 'mouse' && e.button !== 0) return;

        dragState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false, dx: 0 };
    }

    function onDragMove(e) {
        const state = dragState.current;
        if (state.pointerId !== e.pointerId) return;

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        if (!state.active) {
            // Not yet decided whether this is a swipe or a scroll/tap: wait for
            // a clear horizontal move before taking over the gesture.
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;

            state.active = true;
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        }

        // Only one direction does anything: left-to-right on the other
        // person's message, right-to-left on your own. The other direction is
        // just resisted (stays at 0) rather than fighting the gesture.
        const clamped = isMine
            ? Math.max(Math.min(dx, 0), -REPLY_MAX_DRAG)
            : Math.min(Math.max(dx, 0), REPLY_MAX_DRAG);

        state.dx = clamped;
        setDragX(clamped);
    }

    function endDrag() {
        const state = dragState.current;

        if (state.active && Math.abs(state.dx) >= REPLY_THRESHOLD) {
            onReply(message);
        }

        dragState.current = { pointerId: null, startX: 0, startY: 0, active: false, dx: 0 };
        setIsDragging(false);
        setDragX(0);
    }

    const files = message.attachments ?? [];
    const images = files.filter((file) => file.is_image);
    const otherFiles = files.filter((file) => !file.is_image);
    // A bubble needs text or a non-media file; "edited" is shown under it, not as a bubble of its own.
    const hasBubble = !!message.body || otherFiles.length > 0;
    // A shared offer, request, or location is not text, so there is nothing to
    // edit; a quote is edited from its own card; and a message that carries
    // files (or pictures/clips) is sent as it is - delete it and send again.
    const canEdit =
        isMine &&
        !message.deleted &&
        !message.offer &&
        !message.request &&
        !message.quote &&
        !message.location &&
        files.length === 0;

    function startEdit() {
        onEdit?.(message);
    }

    const [unsending, setUnsending] = useState(false);

    function remove(scope) {
        setUnsending(false);
        router.delete(route('messages.destroy', message.id), {
            data: { scope },
            preserveScroll: true,
            onSuccess: (page) => onMessagesChange(page.props.messages),
        });
    }

    // Pinning is shared, not personal like pinning a whole conversation:
    // either person can pin or unpin, and both see the same pinned bar.
    function togglePin() {
        router.post(
            route(message.pinned_at ? 'messages.unpin' : 'messages.pin', message.id),
            {},
            { preserveScroll: true, onSuccess: (page) => onMessagesChange(page.props.messages) },
        );
    }

    // The ⋯ button opens a small dialog with what can be done to the message.
    // It floats above the chat (so the scrolling list never clips it) and flips
    // upward when there is no room below.
    const menuItem =
        'block w-full px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800';

    const menuButton = (
        <Menu>
            <MenuButton
                aria-label="Message options"
                className="shrink-0 self-center rounded-full px-1.5 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 data-[open]:bg-gray-100 data-[open]:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:data-[open]:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100"
            >
                ⋯
            </MenuButton>

            <MenuItems
                anchor={isMine ? 'bottom end' : 'bottom start'}
                className="z-50 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:6px] focus:outline-none dark:bg-gray-700"
            >
                {canReply && (
                    <MenuItem>
                        <button type="button" onClick={() => onReply(message)} className={menuItem}>
                            Reply
                        </button>
                    </MenuItem>
                )}
                {!message.deleted && (
                    <MenuItem>
                        <button type="button" onClick={togglePin} className={menuItem}>
                            {message.pinned_at ? 'Unpin message' : 'Pin message'}
                        </button>
                    </MenuItem>
                )}
                {isMine && (
                    <MenuItem>
                        <button type="button" onClick={() => setViewingDetails(true)} className={menuItem}>
                            View details
                        </button>
                    </MenuItem>
                )}
                {canEdit && (
                    <MenuItem>
                        <button type="button" onClick={startEdit} className={menuItem}>
                            Edit
                        </button>
                    </MenuItem>
                )}
                {isMine && !message.deleted ? (
                    <MenuItem>
                        <button
                            type="button"
                            onClick={() => setUnsending(true)}
                            className={`${menuItem} text-red-600 dark:text-red-400`}
                        >
                            Unsend
                        </button>
                    </MenuItem>
                ) : (
                    <MenuItem>
                        <button type="button" onClick={() => remove('me')} className={menuItem}>
                            Delete for me
                        </button>
                    </MenuItem>
                )}
                {!isMine && (
                    <MenuItem disabled={reported}>
                        {reported ? (
                            <span className="block px-4 py-2 text-sm text-gray-400">Reported</span>
                        ) : (
                            <button type="button" onClick={() => setReporting(true)} className={menuItem}>
                                Report
                            </button>
                        )}
                    </MenuItem>
                )}
            </MenuItems>
        </Menu>
    );

    // A small reply shortcut that only shows up on hover, right beside the ⋯
    // button - the same reveal treatment, so the two read as one toolbar.
    const replyButton = canReply && (
        <button
            type="button"
            onClick={() => onReply(message)}
            aria-label="Reply"
            title="Reply"
            className="shrink-0 self-center rounded-full p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 sm:group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
            <ReplyIcon className="h-4 w-4" />
        </button>
    );

    // Shown beside the message while it is hovered (wide screens), on the side
    // facing the middle of the chat.
    const sentAt = (
        <span
            title={formatDateTime(message.created_at)}
            className="hidden shrink-0 self-center whitespace-nowrap text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:text-gray-500"
        >
            {formatMessageTime(message.created_at)}
        </span>
    );

    // Whether this message shows the toolbar (…, reply, time) parked at the
    // outer, whole-row level - only true for the two single-block states
    // (deleted, being edited) where there's nothing else stacked around the
    // content. For a normal message it's rendered further down, scoped to
    // just the content block, so it centers on that regardless of whatever
    // meta labels (pinned, edited, automatic reply, reply preview, delivery
    // status) happen to be stacked above or below it.
    const outerToolbar = message.deleted;

    return (
        <div id={`message-${message.id}`} className={`group relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && <Avatar user={author} size="sm" />}
            {isMine && outerToolbar && sentAt}
            {isMine && outerToolbar && replyButton}
            {isMine && outerToolbar && menuButton}

            {/* Fades in as the swipe passes the threshold, in the gap the bubble
                is pulling away from. Anchored to the row, but offset past the
                avatar's width + gap on the other person's side so it can't land
                on top of it. */}
            {canReply && dragX !== 0 && (
                <span
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-indigo-500 ${isMine ? 'right-0' : 'left-10'}`}
                    style={{ opacity: Math.min(1, Math.abs(dragX) / REPLY_THRESHOLD) }}
                >
                    <ReplyIcon className="h-5 w-5" />
                </span>
            )}

            <div
                onPointerDown={onDragStart}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{
                    transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
                    transition: isDragging ? 'none' : 'transform 200ms ease-out',
                    touchAction: canReply ? 'pan-y' : undefined,
                }}
                className={`flex min-w-0 max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
                {message.reply_to && (
                    <button
                        type="button"
                        onClick={() => jumpToMessage(message.reply_to.id)}
                        className={`mb-1 max-w-full rounded-md bg-gray-50 px-2 py-1 text-start text-xs text-gray-600 hover:bg-gray-100 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:bg-gray-900/70`}
                    >
                        <span className="block truncate font-medium text-indigo-600 dark:text-indigo-400">
                            {message.reply_to.sender_id === myId ? 'You' : message.reply_to.sender_name}
                        </span>
                        <span className="block truncate">
                            {message.reply_to.deleted ? 'This message was deleted' : message.reply_to.preview ?? 'Attachment'}
                        </span>
                    </button>
                )}
                {message.automated && !message.deleted && (
                    <p className="mb-1 px-1 text-[11px] text-gray-500 dark:text-gray-400">Automatic reply</p>
                )}
                {message.deleted ? (
                    <div className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm italic text-gray-500 dark:border-gray-600 dark:text-gray-400">
                        {isMine ? 'You deleted this message' : 'This message was deleted'}
                    </div>
                ) : (
                    <div className={`flex flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`}>
                        {/* Above the bubble, not inside it. */}
                        {message.pinned_at && (
                            <p className="-mb-1 flex items-center gap-1 px-1 text-[11px] text-indigo-500 dark:text-indigo-400">
                                <PushpinIcon className="h-3 w-3" />
                                Pinned{message.pinned_by ? ` by ${message.pinned_by}` : ''}
                            </p>
                        )}

                        {/* A quote says it was edited on its own card. */}
                        {message.edited_at && !message.quote && (
                            <p
                                className="-mb-1 px-1 text-[11px] text-gray-500 dark:text-gray-400"
                                title={`Edited ${formatDateTime(message.edited_at)}`}
                            >
                                edited
                            </p>
                        )}

                        {/* The toolbar sits in this row, next to the content only -
                            not the meta labels above or the status line below - so
                            it always lands in the middle of the content itself. */}
                        <div className="flex items-center gap-2">
                            {isMine && sentAt}
                            {isMine && replyButton}
                            {isMine && menuButton}

                            <div className={`flex min-w-0 flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`}>
                                {message.offer && <SharedOfferCard offer={message.offer} onImageLoad={onImageLoad} />}

                                {message.request && <SharedRequestCard request={message.request} onImageLoad={onImageLoad} />}

                                {message.location && (
                                    <SharedLocationCard location={message.location} onImageLoad={onImageLoad} />
                                )}

                                {message.quote && (
                                    <SharedQuoteCard quote={message.quote} isMine={isMine} onMessagesChange={onMessagesChange} />
                                )}

                                {images.length > 0 && <MessageAttachments attachments={images} onImageLoad={onImageLoad} />}

                                {hasBubble && (
                                    <div
                                        className={`space-y-2 break-words rounded-lg px-4 py-2 ${
                                            isMine ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                                        }`}
                                    >
                                        {message.body && (
                                            <p className="whitespace-pre-line text-sm">
                                                {highlight ? highlightText(message.body, highlight) : message.body}
                                            </p>
                                        )}
                                        {otherFiles.length > 0 && (
                                            <MessageAttachments attachments={otherFiles} onImageLoad={onImageLoad} />
                                        )}
                                    </div>
                                )}
                            </div>

                            {!isMine && menuButton}
                            {!isMine && replyButton}
                            {!isMine && sentAt}
                        </div>

                        {/* Under the bubble: "Delivered", or "Seen" and how long ago. Only
                            the last message in the conversation shows it here; for any
                            other one, "View details" in the ⋯ menu has the same info. */}
                        {isMine && isLast && (
                            <MessageStatus seen={!!message.read_at} readAt={message.read_at} />
                        )}
                    </div>
                )}
            </div>

            {!isMine && outerToolbar && menuButton}
            {!isMine && outerToolbar && replyButton}
            {!isMine && outerToolbar && sentAt}

            <ReportModal
                show={reporting}
                onClose={() => setReporting(false)}
                title="Report this message"
                description={`Tell the admins what is wrong with this message from ${otherName}. They can read the conversation to decide, and ${otherName} is not told who reported it.`}
                action={route('messages.report', message.id)}
                reasons={reasons}
            />

            <MessageDetailsModal show={viewingDetails} onClose={() => setViewingDetails(false)} message={message} />

            <UnsendPanel show={unsending} onClose={() => setUnsending(false)} onChoose={remove} />
        </div>
    );
}

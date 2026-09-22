import Avatar from '@/Components/Avatar';
import MediaLightbox from '@/Components/MediaLightbox';
import PlayIcon from '@/Components/PlayIcon';
import ReportModal from '@/Components/ReportModal';
import { formatMessageTime } from '@/lib/dates';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { router } from '@inertiajs/react';
import { useRef, useState } from 'react';

const menuItemClass =
    'block w-full px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800';

// Same gesture and thresholds as a single message row (see MessageRow).
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

function jumpToMessage(id) {
    const el = document.getElementById(`message-${id}`);
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-indigo-400', 'rounded-lg');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'rounded-lg'), 1200);
}

// Up to three thumbnails fanned out behind each other, front one on top, with
// a count badge when there is more than one file.
function StackThumb({ attachments, onOpen }) {
    const shown = attachments.slice(0, 3);

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${attachments.length} files`}
            className="relative block h-32 w-32 sm:h-36 sm:w-36"
        >
            {shown
                .map((attachment, i) => ({ attachment, i }))
                .reverse()
                .map(({ attachment, i }) => {
                    const depth = shown.length - 1 - i; // 0 = front-most (on top)
                    const offset = depth * 7;
                    const rotate = depth === 0 ? 0 : (i % 2 === 0 ? -1 : 1) * (depth * 4);

                    return (
                        <span
                            key={attachment.id}
                            style={{
                                transform: `translate(${offset}px, ${-offset}px) rotate(${rotate}deg)`,
                                zIndex: 10 - depth,
                            }}
                            className="absolute inset-0 overflow-hidden rounded-lg border-2 border-white shadow-md dark:border-gray-900"
                        >
                            {attachment.is_video ? (
                                <span className="relative block h-full w-full bg-gray-800">
                                    <video src={attachment.url} className="h-full w-full object-cover opacity-90" />
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <PlayIcon className="h-11 w-11" />
                                    </span>
                                </span>
                            ) : (
                                <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                            )}
                        </span>
                    );
                })}

        </button>
    );
}

// Several pictures/clips chosen and sent together, shown as one stacked card
// instead of separate bubbles. Each still has its own message row (so its own
// `id`), which is what lets the viewer delete or report one item on its own;
// the card's own menu below acts on the whole stack at once, since that is
// how it was sent.
export default function MediaStackRow({ messages, isMine, author, myId, otherName, reported, reasons, onMessagesChange, onImageLoad, onReply }) {
    const [viewingIndex, setViewingIndex] = useState(null);
    const [reporting, setReporting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const attachments = messages.flatMap((message) => message.attachments ?? []);
    // How far the fanned-out thumbnails reach past the front one (upward and
    // to the right) - 3 or more fan out further than 2.
    const fan = attachments.length >= 3 ? 24 : attachments.length === 2 ? 12 : 0;
    const first = messages[0];
    const last = messages[messages.length - 1];
    // Which message each attachment belongs to, so a single item can be deleted on its own.
    const messageFor = new Map(messages.flatMap((message) => (message.attachments ?? []).map((a) => [a.id, message])));

    // A reply targets the stack as a whole: the first row of the batch is
    // where the server keeps the reply, same as it does for a text message.
    const canReply = typeof onReply === 'function';
    const dragState = useRef({ pointerId: null, startX: 0, startY: 0, active: false, dx: 0 });

    function onDragStart(e) {
        if (!canReply || (e.pointerType === 'mouse' && e.button !== 0)) return;

        dragState.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, active: false, dx: 0 };
    }

    function onDragMove(e) {
        const state = dragState.current;
        if (state.pointerId !== e.pointerId) return;

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        if (!state.active) {
            if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) return;

            state.active = true;
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        }

        const clamped = isMine
            ? Math.max(Math.min(dx, 0), -REPLY_MAX_DRAG)
            : Math.min(Math.max(dx, 0), REPLY_MAX_DRAG);

        state.dx = clamped;
        setDragX(clamped);
    }

    function endDrag() {
        const state = dragState.current;

        if (state.active && Math.abs(state.dx) >= REPLY_THRESHOLD) {
            onReply({
                id: first.id,
                sender_id: first.sender_id,
                body: null,
                offer: null,
                request: null,
                quote: null,
                location: null,
                attachments,
            });
        }

        dragState.current = { pointerId: null, startX: 0, startY: 0, active: false, dx: 0 };
        setIsDragging(false);
        setDragX(0);
    }

    function removeAll(scope) {
        setRemoving(true);
        const queue = [...messages];

        function next() {
            const message = queue.shift();

            if (!message) {
                setRemoving(false);
                return;
            }

            router.delete(route('messages.destroy', message.id), {
                data: { scope },
                preserveScroll: true,
                onSuccess: (page) => onMessagesChange(page.props.messages),
                onFinish: next,
            });
        }

        next();
    }

    function removeOne(attachmentId, scope) {
        const message = messageFor.get(attachmentId);
        if (!message) return;

        router.delete(route('messages.destroy', message.id), {
            data: { scope },
            preserveScroll: true,
            onSuccess: (page) => {
                onMessagesChange(page.props.messages);
                setViewingIndex(null);
            },
        });
    }

    const menuButton = (
        <Menu>
            <MenuButton
                aria-label="Stack options"
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
                        <button
                            type="button"
                            onClick={() =>
                                onReply({
                                    id: first.id,
                                    sender_id: first.sender_id,
                                    body: null,
                                    offer: null,
                                    request: null,
                                    quote: null,
                                    location: null,
                                    attachments,
                                })
                            }
                            className={menuItemClass}
                        >
                            Reply
                        </button>
                    </MenuItem>
                )}
                <MenuItem disabled={removing}>
                    <button type="button" onClick={() => removeAll('me')} className={menuItemClass}>
                        Delete for me
                    </button>
                </MenuItem>
                {isMine && (
                    <MenuItem disabled={removing}>
                        <button
                            type="button"
                            onClick={() => removeAll('everyone')}
                            className={`${menuItemClass} text-red-600 dark:text-red-400`}
                        >
                            Delete for everyone
                        </button>
                    </MenuItem>
                )}
                {!isMine && (
                    <MenuItem disabled={reported}>
                        {reported ? (
                            <span className="block px-4 py-2 text-sm text-gray-400">Reported</span>
                        ) : (
                            <button type="button" onClick={() => setReporting(true)} className={menuItemClass}>
                                Report
                            </button>
                        )}
                    </MenuItem>
                )}
            </MenuItems>
        </Menu>
    );

    const sentAt = (
        <span className="hidden shrink-0 self-center whitespace-nowrap text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:text-gray-500">
            {formatMessageTime(last.created_at)}
        </span>
    );

    return (
        <div id={`message-${first.id}`} className={`group relative flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && <Avatar user={author} size="sm" />}
            {isMine && sentAt}
            {isMine && menuButton}

            {canReply && dragX !== 0 && (
                <span
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-indigo-500 ${isMine ? 'right-0' : 'left-0'}`}
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
                    ...(isMine ? { marginRight: fan } : {}),
                }}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
            >
                {first.reply_to && (
                    <button
                        type="button"
                        onClick={() => jumpToMessage(first.reply_to.id)}
                        className="mb-1 max-w-full rounded-md border-s-2 border-indigo-400 bg-gray-50 px-2 py-1 text-start text-xs text-gray-600 hover:bg-gray-100 dark:border-indigo-500 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:bg-gray-900/70"
                    >
                        <span className="block truncate font-medium text-indigo-600 dark:text-indigo-400">
                            {first.reply_to.sender_id === myId ? 'You' : first.reply_to.sender_name}
                        </span>
                        <span className="block truncate italic">
                            {first.reply_to.deleted ? 'This message was deleted' : first.reply_to.preview ?? 'Attachment'}
                        </span>
                    </button>
                )}
                {/* The thumbnails fan out upward, so leave them room above the caption. */}
                <p className="relative z-20 text-xs text-gray-500 dark:text-gray-400" style={{ marginBottom: fan + 8 }}>
                    {isMine ? 'You' : otherName} sent {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                </p>
                <StackThumb attachments={attachments} onOpen={() => setViewingIndex(0)} />
            </div>

            {!isMine && menuButton}
            {!isMine && sentAt}

            {viewingIndex !== null && (
                <MediaLightbox
                    attachments={attachments}
                    index={viewingIndex}
                    onIndexChange={setViewingIndex}
                    onClose={() => setViewingIndex(null)}
                    onImageLoad={onImageLoad}
                    isMine={isMine}
                    onRemove={isMine ? removeOne : undefined}
                />
            )}

            <ReportModal
                show={reporting}
                onClose={() => setReporting(false)}
                title="Report this stack"
                description={`Tell the admins what is wrong with these files from ${otherName}. They can read the conversation to decide, and ${otherName} is not told who reported it.`}
                action={route('messages.report', last.id)}
                reasons={reasons}
            />
        </div>
    );
}

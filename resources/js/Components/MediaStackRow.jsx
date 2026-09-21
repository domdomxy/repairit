import Avatar from '@/Components/Avatar';
import MediaLightbox from '@/Components/MediaLightbox';
import PlayIcon from '@/Components/PlayIcon';
import ReportModal from '@/Components/ReportModal';
import { formatMessageTime } from '@/lib/dates';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const menuItemClass =
    'block w-full px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800';

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
export default function MediaStackRow({ messages, isMine, author, otherName, reported, reasons, onMessagesChange, onImageLoad }) {
    const [viewingIndex, setViewingIndex] = useState(null);
    const [reporting, setReporting] = useState(false);
    const [removing, setRemoving] = useState(false);

    const attachments = messages.flatMap((message) => message.attachments ?? []);
    // How far the fanned-out thumbnails reach past the front one (upward and
    // to the right) - 3 or more fan out further than 2.
    const fan = attachments.length >= 3 ? 24 : attachments.length === 2 ? 12 : 0;
    const last = messages[messages.length - 1];
    // Which message each attachment belongs to, so a single item can be deleted on its own.
    const messageFor = new Map(messages.flatMap((message) => (message.attachments ?? []).map((a) => [a.id, message])));

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
        <div className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && <Avatar user={author} size="sm" />}
            {isMine && sentAt}
            {isMine && menuButton}

            <div
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                // Keep the fan clear of the scrollbar on my side.
                style={isMine ? { marginRight: fan } : undefined}
            >
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

import Avatar from '@/Components/Avatar';
import DangerButton from '@/Components/DangerButton';
import MediaLightbox from '@/Components/MediaLightbox';
import Modal from '@/Components/Modal';
import ReportModal from '@/Components/ReportModal';
import SecondaryButton from '@/Components/SecondaryButton';
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
                                    <span className="absolute inset-0 flex items-center justify-center text-2xl text-white drop-shadow">
                                        ▶
                                    </span>
                                </span>
                            ) : (
                                <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                            )}
                        </span>
                    );
                })}

            {attachments.length > 1 && (
                <span className="absolute bottom-1.5 right-1.5 z-20 flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-white">
                    <span aria-hidden="true">🗂️</span>
                    {attachments.length}
                </span>
            )}
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
    const [deleting, setDeleting] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [removing, setRemoving] = useState(false);

    const attachments = messages.flatMap((message) => message.attachments ?? []);
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
                setDeleting(false);
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
                className="mb-1 shrink-0 rounded-full px-1.5 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 data-[open]:bg-gray-100 data-[open]:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:data-[open]:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100"
            >
                ⋯
            </MenuButton>

            <MenuItems
                anchor={isMine ? 'bottom end' : 'bottom start'}
                className="z-50 w-44 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:6px] focus:outline-none dark:bg-gray-700"
            >
                <MenuItem>
                    <button type="button" onClick={() => setDeleting(true)} className={menuItemClass}>
                        Delete all {attachments.length}
                    </button>
                </MenuItem>
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
        <span className="mb-1.5 hidden shrink-0 whitespace-nowrap text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:text-gray-500">
            {formatMessageTime(last.created_at)}
        </span>
    );

    return (
        <div className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && <Avatar user={author} size="sm" />}
            {isMine && sentAt}
            {isMine && menuButton}

            <StackThumb attachments={attachments} onOpen={() => setViewingIndex(0)} />

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

            <Modal show={deleting} onClose={() => !removing && setDeleting(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete all {attachments.length} files?
                    </h2>

                    <dl className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                            <dt className="font-medium text-gray-800 dark:text-gray-200">Delete for me</dt>
                            <dd>They disappear from your chat only. {otherName} can still see them.</dd>
                        </div>
                        {isMine && (
                            <div>
                                <dt className="font-medium text-gray-800 dark:text-gray-200">Delete for everyone</dt>
                                <dd>
                                    Each is replaced by &ldquo;This message was deleted&rdquo; for both of you. If the
                                    conversation is reported, an admin can still read it.
                                </dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <SecondaryButton disabled={removing} onClick={() => setDeleting(false)}>
                            Cancel
                        </SecondaryButton>
                        <SecondaryButton disabled={removing} onClick={() => removeAll('me')}>
                            Delete for me
                        </SecondaryButton>
                        {isMine && (
                            <DangerButton disabled={removing} onClick={() => removeAll('everyone')}>
                                Delete for everyone
                            </DangerButton>
                        )}
                    </div>
                </div>
            </Modal>

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

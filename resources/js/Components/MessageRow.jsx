import Avatar from '@/Components/Avatar';
import DangerButton from '@/Components/DangerButton';
import MessageAttachments from '@/Components/MessageAttachments';
import Modal from '@/Components/Modal';
import ReportModal from '@/Components/ReportModal';
import SecondaryButton from '@/Components/SecondaryButton';
import SharedOfferCard from '@/Components/SharedOfferCard';
import { formatDateTime, formatMessageTime } from '@/lib/dates';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const ACTION = 'text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200';

// One message in the conversation, with what its owner can do to it: edit it
// or delete it (for me / for everyone) when it is theirs, delete it for
// themselves or report it when it is the other person's.
export default function MessageRow({
    message,
    isMine,
    author,
    otherName,
    reported,
    reasons,
    onMessagesChange,
    onImageLoad,
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [editError, setEditError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [reporting, setReporting] = useState(false);

    const files = message.attachments ?? [];
    const images = files.filter((file) => file.is_image);
    const otherFiles = files.filter((file) => !file.is_image);
    const hasBubble = !!message.body || otherFiles.length > 0 || !!message.edited_at;
    // A shared offer is not text, so there is nothing to edit.
    const canEdit = isMine && !message.deleted && !message.offer;

    function startEdit() {
        setDraft(message.body ?? '');
        setEditError(null);
        setEditing(true);
    }

    function saveEdit(e) {
        e.preventDefault();

        setSaving(true);
        router.patch(
            route('messages.update', message.id),
            { body: draft },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    onMessagesChange(page.props.messages);
                    setEditing(false);
                },
                onError: (errors) => setEditError(errors.body ?? 'The message could not be saved.'),
                onFinish: () => setSaving(false),
            },
        );
    }

    function remove(scope) {
        router.delete(route('messages.destroy', message.id), {
            data: { scope },
            preserveScroll: true,
            onSuccess: (page) => {
                onMessagesChange(page.props.messages);
                setDeleting(false);
            },
        });
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
                className="mb-1 shrink-0 rounded-full px-1.5 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:opacity-100 data-[open]:bg-gray-100 data-[open]:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:data-[open]:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100"
            >
                ⋯
            </MenuButton>

            <MenuItems
                anchor={isMine ? 'bottom end' : 'bottom start'}
                className="z-50 w-40 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:6px] focus:outline-none dark:bg-gray-700"
            >
                {canEdit && (
                    <MenuItem>
                        <button type="button" onClick={startEdit} className={menuItem}>
                            Edit
                        </button>
                    </MenuItem>
                )}
                <MenuItem>
                    <button type="button" onClick={() => setDeleting(true)} className={menuItem}>
                        Delete
                    </button>
                </MenuItem>
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

    // Shown beside the message while it is hovered (wide screens), on the side
    // facing the middle of the chat.
    const sentAt = (
        <span
            title={formatDateTime(message.created_at)}
            className="mb-1.5 hidden shrink-0 whitespace-nowrap text-xs text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block dark:text-gray-500"
        >
            {formatMessageTime(message.created_at)}
        </span>
    );

    return (
        <div className={`group flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
            {!isMine && <Avatar user={author} size="sm" />}
            {isMine && sentAt}
            {isMine && menuButton}

            <div className={`flex min-w-0 max-w-[75%] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {message.automated && !message.deleted && !editing && (
                    <p className="mb-1 px-1 text-[11px] text-gray-500 dark:text-gray-400">Automatic reply</p>
                )}
                {message.deleted ? (
                    <div className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm italic text-gray-500 dark:border-gray-600 dark:text-gray-400">
                        {isMine ? 'You deleted this message' : 'This message was deleted'}
                    </div>
                ) : editing ? (
                    <form onSubmit={saveEdit} className="w-72 max-w-full space-y-2">
                        <textarea
                            autoFocus
                            rows={3}
                            maxLength={5000}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            aria-label="Edit message"
                            className="block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                        {editError && <p className="text-xs text-red-600">{editError}</p>}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditing(false)} className={ACTION}>
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className={`flex flex-col gap-2 ${isMine ? 'items-end' : 'items-start'}`}>
                        {message.offer && <SharedOfferCard offer={message.offer} onImageLoad={onImageLoad} />}

                        {images.length > 0 && <MessageAttachments attachments={images} onImageLoad={onImageLoad} />}

                        {hasBubble && (
                            <div
                                className={`space-y-2 break-words rounded-lg px-4 py-2 ${
                                    isMine ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700'
                                }`}
                            >
                                {message.body && <p className="whitespace-pre-line text-sm">{message.body}</p>}
                                {otherFiles.length > 0 && (
                                    <MessageAttachments attachments={otherFiles} onImageLoad={onImageLoad} />
                                )}
                                {message.edited_at && (
                                    <p
                                        className={`text-[11px] ${isMine ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}
                                        title={`Edited ${formatDateTime(message.edited_at)}`}
                                    >
                                        edited
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!isMine && menuButton}
            {!isMine && sentAt}

            <Modal show={deleting} onClose={() => setDeleting(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Delete this message?</h2>

                    <dl className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                            <dt className="font-medium text-gray-800 dark:text-gray-200">Delete for me</dt>
                            <dd>It disappears from your chat only. {otherName} can still see it.</dd>
                        </div>
                        {isMine && !message.deleted && (
                            <div>
                                <dt className="font-medium text-gray-800 dark:text-gray-200">Delete for everyone</dt>
                                <dd>
                                    It is replaced by &ldquo;This message was deleted&rdquo; for both of you. If the
                                    conversation is reported, an admin can still read it.
                                </dd>
                            </div>
                        )}
                    </dl>

                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <SecondaryButton onClick={() => setDeleting(false)}>Cancel</SecondaryButton>
                        <SecondaryButton onClick={() => remove('me')}>Delete for me</SecondaryButton>
                        {isMine && !message.deleted && (
                            <DangerButton onClick={() => remove('everyone')}>Delete for everyone</DangerButton>
                        )}
                    </div>
                </div>
            </Modal>

            <ReportModal
                show={reporting}
                onClose={() => setReporting(false)}
                title="Report this message"
                description={`Tell the admins what is wrong with this message from ${otherName}. They can read the conversation to decide, and ${otherName} is not told who reported it.`}
                action={route('messages.report', message.id)}
                reasons={reasons}
            />
        </div>
    );
}

import DangerButton from '@/Components/DangerButton';
import Dropdown from '@/Components/Dropdown';
import Modal from '@/Components/Modal';
import ReportModal from '@/Components/ReportModal';
import SecondaryButton from '@/Components/SecondaryButton';
import { router } from '@inertiajs/react';
import { useState } from 'react';

const ITEM =
    'block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:bg-gray-800';

// The "..." menu in the header of a conversation: hide it, delete it (for me
// only) or report it. Hiding and deleting only change this person's own list.
export default function ConversationMenu({ conversation, otherName, reported, reasons }) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [processing, setProcessing] = useState(false);

    function deleteConversation() {
        router.delete(route('conversations.destroy', conversation.id), {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
        });
    }

    return (
        <>
            <Dropdown>
                <Dropdown.Trigger>
                    <button
                        type="button"
                        aria-label="Conversation options"
                        className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        ⋯
                    </button>
                </Dropdown.Trigger>

                <Dropdown.Content>
                    {conversation.is_pinned ? (
                        <Dropdown.Link href={route('conversations.unpin', conversation.id)} method="post" as="button" preserveScroll>
                            Unpin conversation
                        </Dropdown.Link>
                    ) : (
                        <Dropdown.Link href={route('conversations.pin', conversation.id)} method="post" as="button" preserveScroll>
                            Pin conversation
                        </Dropdown.Link>
                    )}

                    {conversation.is_hidden ? (
                        <Dropdown.Link
                            href={route('conversations.unhide', conversation.id)}
                            method="post"
                            as="button"
                            preserveScroll
                        >
                            Unhide conversation
                        </Dropdown.Link>
                    ) : (
                        <Dropdown.Link href={route('conversations.hide', conversation.id)} method="post" as="button">
                            Hide conversation
                        </Dropdown.Link>
                    )}

                    <button type="button" onClick={() => setConfirmingDelete(true)} className={ITEM}>
                        Delete conversation
                    </button>

                    {reported ? (
                        <p className="px-4 py-2 text-sm text-gray-400">You reported this conversation</p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setReporting(true)}
                            className={`${ITEM} text-red-600 dark:text-red-400`}
                        >
                            Report conversation
                        </button>
                    )}
                </Dropdown.Content>
            </Dropdown>

            <Modal show={confirmingDelete} onClose={() => setConfirmingDelete(false)} maxWidth="md">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Delete this conversation?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        The messages are removed from your side only. {otherName} keeps their copy and is not told. If
                        either of you writes again, the conversation comes back with just the new messages.
                    </p>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setConfirmingDelete(false)}>Cancel</SecondaryButton>
                        <DangerButton onClick={deleteConversation} disabled={processing}>
                            Delete conversation
                        </DangerButton>
                    </div>
                </div>
            </Modal>

            <ReportModal
                show={reporting}
                onClose={() => setReporting(false)}
                title="Report this conversation"
                description={`Tell the admins what is wrong with your conversation with ${otherName}. They can read all of it to decide, including messages that were deleted. ${otherName} is not told who reported it.`}
                action={route('conversations.report', conversation.id)}
                reasons={reasons}
            />
        </>
    );
}

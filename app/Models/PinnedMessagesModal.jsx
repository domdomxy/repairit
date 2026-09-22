import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { PushpinIcon, XIcon } from '@/Components/Icons';
import { summarize } from '@/Components/PinnedMessagesBar';
import { formatMessageTime } from '@/lib/dates';

// The full list of pinned messages in this conversation, reachable from the
// conversation menu. The inline PinnedMessagesBar under the header shows the
// same set, but this is where you go to actually browse them all rather than
// scroll a short strip - useful once a conversation has more than a couple.
export default function PinnedMessagesModal({ show, onClose, messages, myId, onJump, onUnpin }) {
    // Most recently pinned first, same order as the inline bar.
    const pinned = [...messages].sort((a, b) => new Date(b.pinned_at) - new Date(a.pinned_at));

    function jump(id) {
        onJump(id);
        onClose();
    }

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Pinned messages{pinned.length > 0 ? ` (${pinned.length})` : ''}
                </h2>

                {pinned.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                        Nothing is pinned in this conversation yet. Pin a message from its ⋯ menu to keep it here.
                    </p>
                ) : (
                    <ul className="mt-4 max-h-96 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-700">
                        {pinned.map((message) => (
                            <li key={message.id} className="flex items-center gap-3 py-3">
                                <PushpinIcon className="h-4 w-4 shrink-0 text-indigo-500" />
                                <button
                                    type="button"
                                    onClick={() => jump(message.id)}
                                    className="min-w-0 flex-1 text-start"
                                >
                                    <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {message.sender_id === myId ? 'You' : message.sender_name}
                                        <span className="font-normal text-gray-400 dark:text-gray-500">
                                            {formatMessageTime(message.created_at)}
                                        </span>
                                    </span>
                                    <span className="block truncate text-sm text-gray-600 dark:text-gray-400">
                                        {summarize(message)}
                                    </span>
                                    {message.pinned_by && (
                                        <span className="block text-xs text-gray-400 dark:text-gray-500">
                                            Pinned by {message.pinned_by}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onUnpin(message.id)}
                                    aria-label="Unpin message"
                                    title="Unpin message"
                                    className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="mt-6 flex justify-end">
                    <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                </div>
            </div>
        </Modal>
    );
}

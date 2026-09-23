import Modal from '@/Components/Modal';
import PlayIcon from '@/Components/PlayIcon';
import SecondaryButton from '@/Components/SecondaryButton';
import { ChatIcon, DocumentIcon } from '@/Components/Icons';
import { formatSize } from '@/lib/files';
import { formatMessageTime } from '@/lib/dates';
import { useMemo, useState } from 'react';

const TABS = [
    { key: 'media', label: 'Media' },
    { key: 'files', label: 'Files' },
];

// Every file shared in this conversation, gathered from the messages already
// loaded on the page (the same `attachments` each message carries inline) -
// nothing extra to fetch. Reachable from the conversation's ⋯ menu. Media
// (pictures and clips) gets a grid with its own lightbox; everything else is
// a plain, downloadable row. Either kind can be jumped to in the chat itself.
export default function AttachmentsModal({ show, onClose, messages, people, myId, onJump }) {
    const [tab, setTab] = useState('media');
    const [viewing, setViewing] = useState(null);

    // Flattened, most recent first, each tagged with who sent it, when, and
    // which message it belongs to (so "Jump to message" has somewhere to go).
    const items = useMemo(() => {
        return messages
            .filter((message) => !message.deleted && message.attachments?.length)
            .flatMap((message) =>
                message.attachments.map((attachment) => ({
                    ...attachment,
                    message_id: message.id,
                    sender_id: message.sender_id,
                    sender_name: message.sender_id === myId ? 'You' : people[message.sender_id]?.name,
                    created_at: message.created_at,
                })),
            )
            .reverse();
    }, [messages, people, myId]);

    const media = items.filter((item) => item.is_image || item.is_video);
    const files = items.filter((item) => !item.is_image && !item.is_video);

    function jump(id) {
        onJump(id);
        onClose();
    }

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <div className="flex max-h-[85vh] flex-col p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Shared files</h2>

                <div className="mt-3 flex gap-1 border-b border-gray-200 dark:border-gray-700">
                    {TABS.map(({ key, label }) => {
                        const count = key === 'media' ? media.length : files.length;

                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                                    tab === key
                                        ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                {label}
                                {count > 0 ? ` (${count})` : ''}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                    {tab === 'media' ? (
                        media.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                                No pictures or clips have been shared here yet.
                            </p>
                        ) : (
                            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                                {media.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setViewing(item)}
                                        className="relative block aspect-square overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900"
                                        title={item.name}
                                    >
                                        {item.is_video ? (
                                            <>
                                                <video src={item.url} className="h-full w-full object-cover" />
                                                <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                    <PlayIcon className="h-8 w-8" />
                                                </span>
                                            </>
                                        ) : (
                                            <img
                                                src={item.url}
                                                alt={item.name ?? 'Image'}
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )
                    ) : files.length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                            No other files have been shared here yet.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {files.map((file) => (
                                <li key={file.id} className="flex items-center gap-3 py-3">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                                        <DocumentIcon className="h-5 w-5" />
                                    </span>
                                    <a
                                        href={file.url}
                                        download={file.name ?? true}
                                        className="min-w-0 flex-1"
                                    >
                                        <span className="block truncate text-sm font-medium text-gray-800 hover:underline dark:text-gray-100">
                                            {file.name}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                                            {file.sender_name} · {formatMessageTime(file.created_at)} · {formatSize(file.size)}
                                        </span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => jump(file.message_id)}
                                        title="Jump to message"
                                        aria-label="Jump to message"
                                        className="shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                                    >
                                        <ChatIcon className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-4 flex justify-end">
                    <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                </div>
            </div>

            <Modal show={viewing !== null} onClose={() => setViewing(null)} maxWidth="4xl">
                {viewing && (
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                            <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                {viewing.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => jump(viewing.message_id)}
                                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Jump to message
                                </button>
                                <a
                                    href={viewing.url}
                                    download={viewing.name ?? true}
                                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Download
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setViewing(null)}
                                    aria-label="Close"
                                    className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex max-h-[80vh] items-center justify-center overflow-auto bg-gray-100 p-2 dark:bg-gray-900">
                            {viewing.is_image ? (
                                <img
                                    src={viewing.url}
                                    alt={viewing.name ?? 'Image'}
                                    className="max-h-[75vh] max-w-full object-contain"
                                />
                            ) : (
                                <video src={viewing.url} controls autoPlay className="max-h-[75vh] max-w-full" />
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </Modal>
    );
}

import { useEffect, useRef, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import Avatar from '@/Components/Avatar';
import ConversationInfo from '@/Components/ConversationInfo';
import MessagesShell from '@/Components/MessagesShell';

function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Same list the server shows inline; anything else is a plain file chip.
const PREVIEWABLE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// The files of a message bubble: pictures are shown inline (side by side when
// there are several), everything else is a download link. Both go through the
// authorised attachment route.
function Attachments({ attachments, onImageLoad }) {
    const images = attachments.filter((attachment) => attachment.is_image);
    const files = attachments.filter((attachment) => !attachment.is_image);

    return (
        <div className="space-y-2">
            {images.length > 0 && (
                <div className={images.length > 1 ? 'grid grid-cols-2 gap-1' : ''}>
                    {images.map((image) => (
                        <a key={image.id} href={image.url} target="_blank" rel="noopener noreferrer">
                            <img
                                src={image.url}
                                alt={image.name ?? 'Image'}
                                onLoad={onImageLoad}
                                className={
                                    images.length > 1
                                        ? 'h-28 w-full rounded-md object-cover'
                                        : 'max-h-60 rounded-md'
                                }
                            />
                        </a>
                    ))}
                </div>
            )}

            {files.map((file) => (
                <a
                    key={file.id}
                    href={file.url}
                    download={file.name ?? true}
                    className="flex items-center gap-2 text-sm"
                >
                    <span aria-hidden="true">📎</span>
                    <span className="break-all underline">{file.name}</span>
                    <span className="shrink-0 text-xs opacity-75">{formatSize(file.size)}</span>
                </a>
            ))}
        </div>
    );
}

// One chosen file in the composer, with a thumbnail when it is a picture.
function PendingFile({ file, error, onRemove }) {
    const [previewUrl, setPreviewUrl] = useState(null);

    // The preview is a temporary browser URL: made when the file appears and
    // let go of when it is removed.
    useEffect(() => {
        if (!PREVIEWABLE.includes(file.type)) return undefined;

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <li
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                error ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-100 dark:bg-gray-800'
            }`}
        >
            {previewUrl ? (
                <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
                <span aria-hidden="true">📎</span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate">{file.name}</span>
                <span className="text-xs text-gray-500">{formatSize(file.size)}</span>
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="text-gray-500 hover:text-gray-700"
            >
                ✕
            </button>
        </li>
    );
}

// The conversation itself (section 2). Keyed by conversation in Show, so opening
// another conversation starts it afresh: its own messages, composer and live
// connection.
function Chat({ conversation, messages: initialMessages, attachments: limits, onToggleInfo }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const [fileProblems, setFileProblems] = useState([]);
    const bottomRef = useRef(null);
    const fileInput = useRef(null);

    const otherParty =
        auth.user.id === conversation.customer_id
            ? conversation.technician
            : conversation.customer;

    // Who wrote a message: only two people are in a conversation.
    const people = {
        [conversation.customer_id]: conversation.customer,
        [conversation.technician_id]: conversation.technician,
    };

    // Live incoming messages
    useEcho(`conversation.${conversation.id}`, '.message.sent', (event) => {
        setMessages((current) => [...current, event]);
        // Bring the list's preview and order up to date. "async" so it can't
        // interrupt a message that is being sent at the same moment.
        router.reload({ only: ['conversations'], async: true });
    });

    function scrollToBottom() {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    useEffect(scrollToBottom, [messages]);

    const { data, setData, post, processing, progress, reset, errors, clearErrors } = useForm({
        body: '',
        attachments: [],
    });

    function removeFile(index) {
        clearErrors();
        setFileProblems([]);
        setData(
            'attachments',
            data.attachments.filter((_, position) => position !== index),
        );
    }

    // Add to what is already chosen, so files can be picked in several rounds.
    function pickFiles(e) {
        const picked = Array.from(e.target.files ?? []);
        // Clear the input so choosing the same file again still fires onChange.
        e.target.value = '';
        if (picked.length === 0) return;

        clearErrors();

        const next = [...data.attachments];
        const problems = [];
        let total = next.reduce((sum, file) => sum + file.size, 0);

        for (const file of picked) {
            const extension = file.name.split('.').pop()?.toLowerCase();
            const duplicate = next.some(
                (existing) =>
                    existing.name === file.name &&
                    existing.size === file.size &&
                    existing.lastModified === file.lastModified,
            );

            if (duplicate) continue;

            if (!limits.extensions.includes(extension)) {
                problems.push(`${file.name}: that file type is not allowed.`);
            } else if (file.size > limits.max_kb * 1024) {
                problems.push(`${file.name}: larger than ${limits.max_kb / 1024} MB.`);
            } else if (next.length >= limits.max_files) {
                problems.push(`You can attach up to ${limits.max_files} files to one message.`);
                break;
            } else if (total + file.size > limits.max_total_kb * 1024) {
                problems.push(
                    `${file.name}: the files together may not be larger than ${limits.max_total_kb / 1024} MB.`,
                );
            } else {
                next.push(file);
                total += file.size;
            }
        }

        setFileProblems(problems);
        setData('attachments', next);
    }

    function submit(e) {
        e.preventDefault();
        if (!data.body.trim() && data.attachments.length === 0) return;

        post(route('messages.store', conversation.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                // Use the server's copy of the conversation: it has the real ids
                // and attachment URLs. Other people's messages arrive via Echo.
                setMessages(page.props.messages);
                reset();
                setFileProblems([]);
            },
        });
    }

    // Server complaints about one file come back as `attachments.<position>`;
    // name the file so it is clear which one to remove.
    const serverProblems = Object.entries(errors).flatMap(([key, message]) => {
        const match = key.match(/^attachments\.(\d+)$/);

        if (match) return [`${data.attachments[Number(match[1])]?.name ?? 'A file'}: ${message}`];
        if (key === 'attachments' || key === 'body') return [message];

        return [];
    });
    const problems = [...new Set([...fileProblems, ...serverProblems])];
    const rejected = new Set(
        Object.keys(errors)
            .map((key) => key.match(/^attachments\.(\d+)$/)?.[1])
            .filter((position) => position !== undefined)
            .map(Number),
    );

    return (
        <>
            <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <Link
                    href={route('conversations.index')}
                    aria-label="Back to conversations"
                    className="rounded p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 lg:hidden"
                >
                    ←
                </Link>
                <Avatar user={otherParty} size="md" />
                <h3 className="min-w-0 flex-1 truncate font-semibold">{otherParty.name}</h3>
                <button
                    type="button"
                    onClick={onToggleInfo}
                    className="rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 xl:hidden"
                >
                    Info
                </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message) => {
                    const isMine = message.sender_id === auth.user.id;
                    const files = message.attachments ?? [];

                    return (
                        <div
                            key={message.id}
                            className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                        >
                            {!isMine && <Avatar user={people[message.sender_id]} size="sm" />}
                            <div
                                className={`max-w-[75%] px-4 py-2 rounded-lg space-y-2 break-words ${
                                    isMine
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-700'
                                }`}
                            >
                                {message.body && <p className="text-sm">{message.body}</p>}
                                {files.length > 0 && (
                                    <Attachments attachments={files} onImageLoad={scrollToBottom} />
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {conversation.is_request && (
                <p className="border-t border-gray-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-800 dark:border-gray-700 dark:bg-indigo-900/20 dark:text-indigo-200">
                    This is a new request. Reply to move it to your inbox.
                </p>
            )}

            <form onSubmit={submit} className="border-t border-gray-200 p-3 dark:border-gray-700">
                {data.attachments.length > 0 && (
                    <ul className="mb-2 space-y-1">
                        {data.attachments.map((file, index) => (
                            <PendingFile
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                file={file}
                                error={rejected.has(index)}
                                onRemove={() => removeFile(index)}
                            />
                        ))}
                    </ul>
                )}

                {problems.length > 0 && (
                    <div className="mb-2 space-y-1 text-sm text-red-600">
                        {problems.map((problem) => (
                            <p key={problem}>{problem}</p>
                        ))}
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept={limits.extensions.map((extension) => `.${extension}`).join(',')}
                        onChange={pickFiles}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        title="Attach files"
                        aria-label="Attach files"
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md"
                    >
                        📎
                    </button>
                    <input
                        type="text"
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                    />
                    <button
                        type="submit"
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
                    >
                        {processing && data.attachments.length > 0 && progress
                            ? `${progress.percentage}%`
                            : 'Send'}
                    </button>
                </div>
            </form>
        </>
    );
}

export default function Show({ conversation, conversations, contact, messages, attachments }) {
    // The contact panel opens over the conversation on screens too narrow to
    // show it as a column; it starts closed for each conversation.
    const [infoOpen, setInfoOpen] = useState(false);

    useEffect(() => setInfoOpen(false), [conversation.id]);

    return (
        <MessagesShell
            conversations={conversations}
            activeId={conversation.id}
            info={<ConversationInfo contact={contact} open={infoOpen} onClose={() => setInfoOpen(false)} />}
        >
            <Chat
                key={conversation.id}
                conversation={conversation}
                messages={messages}
                attachments={attachments}
                onToggleInfo={() => setInfoOpen((open) => !open)}
            />
        </MessagesShell>
    );
}

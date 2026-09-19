import { useEffect, useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// A file inside a message bubble: pictures are shown inline, everything else is
// a download link. Both go through the authorised attachment route.
function Attachment({ attachment, onImageLoad }) {
    if (attachment.is_image) {
        return (
            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                <img
                    src={attachment.url}
                    alt={attachment.name ?? 'Image'}
                    onLoad={onImageLoad}
                    className="max-h-60 rounded-md"
                />
            </a>
        );
    }

    return (
        <a href={attachment.url} download={attachment.name ?? true} className="flex items-center gap-2 text-sm">
            <span aria-hidden="true">📎</span>
            <span className="break-all underline">{attachment.name}</span>
            <span className="shrink-0 text-xs opacity-75">{formatSize(attachment.size)}</span>
        </a>
    );
}

export default function Show({ conversation, messages: initialMessages, attachments }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const [fileError, setFileError] = useState(null);
    const bottomRef = useRef(null);
    const fileInput = useRef(null);

    const otherParty =
        auth.user.id === conversation.customer_id
            ? conversation.technician
            : conversation.customer;

    // Live incoming messages
    useEcho(`conversation.${conversation.id}`, '.message.sent', (event) => {
        setMessages((current) => [...current, event]);
    });

    function scrollToBottom() {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    useEffect(scrollToBottom, [messages]);

    const { data, setData, post, processing, reset, errors, clearErrors } = useForm({
        body: '',
        attachment: null,
    });

    function clearFile() {
        setData('attachment', null);
        if (fileInput.current) fileInput.current.value = '';
    }

    function pickFile(e) {
        const file = e.target.files?.[0] ?? null;

        clearErrors();
        setFileError(null);

        if (file && file.size > attachments.max_kb * 1024) {
            setFileError(`The file may not be larger than ${attachments.max_kb / 1024} MB.`);
            clearFile();
            return;
        }

        setData('attachment', file);
    }

    function submit(e) {
        e.preventDefault();
        if (!data.body.trim() && !data.attachment) return;

        post(route('messages.store', conversation.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: (page) => {
                // Use the server's copy of the conversation: it has the real ids
                // and attachment URLs. Other people's messages arrive via Echo.
                setMessages(page.props.messages);
                reset();
                setFileError(null);
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    }

    const error = fileError ?? errors.attachment ?? errors.body;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">{otherParty.name}</h2>}>
            <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col h-[70vh]">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {messages.map((message) => {
                        const isMine = message.sender_id === auth.user.id;
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs px-4 py-2 rounded-lg space-y-2 break-words ${
                                        isMine
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800'
                                    }`}
                                >
                                    {message.body && <p className="text-sm">{message.body}</p>}
                                    {message.attachment && (
                                        <Attachment
                                            attachment={message.attachment}
                                            onImageLoad={scrollToBottom}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <form onSubmit={submit} className="mt-4">
                    {data.attachment && (
                        <div className="mb-2 flex items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-sm dark:bg-gray-800">
                            <span className="truncate">
                                📎 {data.attachment.name}{' '}
                                <span className="text-gray-500">({formatSize(data.attachment.size)})</span>
                            </span>
                            <button
                                type="button"
                                onClick={clearFile}
                                aria-label="Remove attachment"
                                className="ml-3 text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

                    <div className="flex gap-2">
                        <input
                            ref={fileInput}
                            type="file"
                            accept={attachments.extensions.map((extension) => `.${extension}`).join(',')}
                            onChange={pickFile}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            title="Attach a file"
                            aria-label="Attach a file"
                            className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md"
                        >
                            📎
                        </button>
                        <input
                            type="text"
                            value={data.body}
                            onChange={(e) => setData('body', e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 rounded-md border-gray-300 dark:bg-gray-800"
                        />
                        <button
                            type="submit"
                            disabled={processing}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
                        >
                            Send
                        </button>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

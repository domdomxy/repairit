import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import Avatar from '@/Components/Avatar';
import ConversationInfo from '@/Components/ConversationInfo';
import ConversationMenu from '@/Components/ConversationMenu';
import MediaStackRow from '@/Components/MediaStackRow';
import MessageRow from '@/Components/MessageRow';
import MessagesShell from '@/Components/MessagesShell';
import { formatSize } from '@/lib/files';

// Same lists the server shows inline; anything else is a plain file chip.
const PREVIEWABLE_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PREVIEWABLE_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/ogg'];

// One chosen file in the composer, with a thumbnail when it is a picture or clip.
function PendingFile({ file, error, onRemove }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    const isVideo = PREVIEWABLE_VIDEO.includes(file.type);

    // The preview is a temporary browser URL: made when the file appears and
    // let go of when it is removed.
    useEffect(() => {
        if (!PREVIEWABLE_IMAGE.includes(file.type) && !isVideo) return undefined;

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file, isVideo]);

    return (
        <li
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                error ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-100 dark:bg-gray-800'
            }`}
        >
            {previewUrl ? (
                isVideo ? (
                    <video src={previewUrl} className="h-10 w-10 shrink-0 rounded object-cover" />
                ) : (
                    <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                )
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
function Chat({ conversation, messages: initialMessages, attachments: limits, moderation, infoOpen, onToggleInfo }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const [fileProblems, setFileProblems] = useState([]);
    const [locationError, setLocationError] = useState(null);
    const [sendingLocation, setSendingLocation] = useState(false);
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

    // Pictures/clips chosen and sent together share a `batch_id` and arrive as
    // consecutive message rows; grouped here into one stacked card instead of
    // separate bubbles. A run only stacks while every message in it is
    // media-only (no text, no other file types) and still visible.
    const groups = useMemo(() => {
        const isMediaOnly = (message) => {
            const files = message.attachments ?? [];

            return (
                !message.deleted &&
                !message.body &&
                !message.offer &&
                !message.request &&
                !message.quote &&
                !message.location &&
                files.length > 0 &&
                files.every((file) => file.is_image || file.is_video)
            );
        };

        const result = [];
        let i = 0;

        while (i < messages.length) {
            const message = messages[i];

            if (message.batch_id && isMediaOnly(message)) {
                const batch = [message];
                let j = i + 1;

                while (
                    j < messages.length &&
                    messages[j].batch_id === message.batch_id &&
                    isMediaOnly(messages[j])
                ) {
                    batch.push(messages[j]);
                    j += 1;
                }

                if (batch.length > 1) {
                    result.push({ type: 'stack', key: `stack-${message.batch_id}`, messages: batch });
                    i = j;
                    continue;
                }
            }

            result.push({ type: 'message', key: `message-${message.id}`, message });
            i += 1;
        }

        return result;
    }, [messages]);

    // Keeps the list's preview and order up to date. "async" so it can't
    // interrupt a message that is being sent at the same moment.
    function refreshList() {
        router.reload({ only: ['conversations'], async: true });
    }

    // Live incoming messages
    useEcho(`conversation.${conversation.id}`, '.message.sent', (event) => {
        setMessages((current) => [...current, event]);
        refreshList();
    });

    // The other person edited a message...
    useEcho(`conversation.${conversation.id}`, '.message.updated', (event) => {
        setMessages((current) =>
            current.map((message) =>
                message.id === event.id
                    ? { ...message, body: event.body, edited_at: event.edited_at, quote: event.quote ?? message.quote }
                    : message,
            ),
        );
        refreshList();
    });

    // ...or took one back for everyone: it stays in place as a placeholder.
    useEcho(`conversation.${conversation.id}`, '.message.deleted', (event) => {
        setMessages((current) =>
            current.map((message) =>
                message.id === event.id
                    ? { ...message, body: null, attachments: [], offer: null, request: null, quote: null, location: null, edited_at: null, deleted: true }
                    : message,
            ),
        );
        refreshList();
    });

    function scrollToBottom() {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }

    // Only when a message arrives or is sent: editing or deleting one further
    // up the conversation shouldn't throw the reader to the bottom.
    const lastMessageId = messages[messages.length - 1]?.id;
    useEffect(scrollToBottom, [messages.length, lastMessageId]);

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

    // Reads the device's location from the browser, then sends it like any
    // other message. The browser handles the actual permission prompt; this
    // only runs once someone has granted it.
    function shareLocation() {
        setLocationError(null);

        if (!navigator.geolocation) {
            setLocationError("Your browser doesn't support sharing your location.");
            return;
        }

        setSendingLocation(true);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                router.post(
                    route('messages.location.store', conversation.id),
                    {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    },
                    {
                        preserveScroll: true,
                        onSuccess: (page) => setMessages(page.props.messages),
                        onError: () => setLocationError('Your location could not be sent.'),
                        onFinish: () => setSendingLocation(false),
                    },
                );
            },
            (error) => {
                setSendingLocation(false);
                setLocationError(
                    error.code === error.PERMISSION_DENIED
                        ? "Location access was denied. Allow it in your browser's settings to share it here."
                        : "Couldn't get your location. Please try again.",
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        );
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
                <ConversationMenu
                    conversation={conversation}
                    otherName={otherParty.name}
                    reported={moderation.reported_conversation}
                    reasons={moderation.reasons}
                />
                <button
                    type="button"
                    onClick={onToggleInfo}
                    aria-expanded={infoOpen}
                    aria-label={infoOpen ? 'Hide contact information' : 'Show contact information'}
                    title={infoOpen ? 'Hide contact information' : 'Show contact information'}
                    className={`rounded-md p-1.5 transition ${
                        infoOpen
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                    }`}
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path strokeLinecap="round" strokeWidth="1.5" d="M12 11v5.25" />
                        <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
                    </svg>
                </button>
            </div>

            {conversation.is_hidden && (
                <p className="flex items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
                    <span>This conversation is hidden. It stays out of your list until you unhide it or write in it.</span>
                    <Link
                        href={route('conversations.unhide', conversation.id)}
                        method="post"
                        as="button"
                        preserveScroll
                        className="shrink-0 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        Unhide
                    </Link>
                </p>
            )}

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {groups.map((group) =>
                    group.type === 'stack' ? (
                        <MediaStackRow
                            key={group.key}
                            messages={group.messages}
                            isMine={group.messages[0].sender_id === auth.user.id}
                            author={people[group.messages[0].sender_id]}
                            otherName={otherParty.name}
                            reported={group.messages.some((message) =>
                                moderation.reported_message_ids.includes(message.id),
                            )}
                            reasons={moderation.reasons}
                            onMessagesChange={setMessages}
                            onImageLoad={scrollToBottom}
                        />
                    ) : (
                        <MessageRow
                            key={group.key}
                            message={group.message}
                            isMine={group.message.sender_id === auth.user.id}
                            author={people[group.message.sender_id]}
                            otherName={otherParty.name}
                            reported={moderation.reported_message_ids.includes(group.message.id)}
                            reasons={moderation.reasons}
                            onMessagesChange={setMessages}
                            onImageLoad={scrollToBottom}
                        />
                    ),
                )}
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

                {(problems.length > 0 || locationError) && (
                    <div className="mb-2 space-y-1 text-sm text-red-600">
                        {problems.map((problem) => (
                            <p key={problem}>{problem}</p>
                        ))}
                        {locationError && <p>{locationError}</p>}
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
                    <button
                        type="button"
                        onClick={shareLocation}
                        disabled={sendingLocation}
                        title="Share your location"
                        aria-label="Share your location"
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md disabled:opacity-50"
                    >
                        {sendingLocation ? '…' : '📍'}
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

// Same breakpoint as Tailwind's `xl`, where the panel becomes a column.
const isWideScreen = () => window.matchMedia('(min-width: 1280px)').matches;

// Whether the contact panel was left open or closed on a wide screen. It lives
// in the browser, per account, so it survives logging out and back in (like the
// theme). Narrow screens don't use it: there the panel is a temporary overlay.
const infoKey = (userId) => `conversation-info-open:${userId}`;

function savedInfoOpen(userId) {
    try {
        const saved = localStorage.getItem(infoKey(userId));

        return saved === null ? null : saved === '1';
    } catch {
        return null; // Storage can be blocked (private mode).
    }
}

function saveInfoOpen(userId, open) {
    try {
        localStorage.setItem(infoKey(userId), open ? '1' : '0');
    } catch {
        // The panel still switches for this visit.
    }
}

export default function Show({ conversation, conversations, contact, messages, attachments, moderation }) {
    const userId = usePage().props.auth.user.id;

    // The contact panel can be shown or hidden with the "Info" button. On wide
    // screens it is a column next to the conversation and comes back the way it
    // was last left (open the first time). On narrow ones it opens over the
    // conversation, starts closed and closes again when another conversation
    // is chosen.
    const [infoOpen, setInfoOpen] = useState(() => (isWideScreen() ? (savedInfoOpen(userId) ?? true) : false));

    function changeInfo(next) {
        setInfoOpen(next);

        if (isWideScreen()) saveInfoOpen(userId, next);
    }

    useEffect(() => {
        if (!isWideScreen()) setInfoOpen(false);
    }, [conversation.id]);

    return (
        <MessagesShell
            conversations={conversations}
            activeId={conversation.id}
            infoOpen={infoOpen}
            info={<ConversationInfo contact={contact} open={infoOpen} onClose={() => changeInfo(false)} />}
        >
            <Chat
                key={conversation.id}
                conversation={conversation}
                messages={messages}
                attachments={attachments}
                moderation={moderation}
                infoOpen={infoOpen}
                onToggleInfo={() => changeInfo(!infoOpen)}
            />
        </MessagesShell>
    );
}

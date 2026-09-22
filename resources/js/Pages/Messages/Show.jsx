import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import { useChannel, useEcho } from '@laravel/echo-react';
import Avatar from '@/Components/Avatar';
import ConversationInfo from '@/Components/ConversationInfo';
import ConversationMenu from '@/Components/ConversationMenu';
import MediaStackRow from '@/Components/MediaStackRow';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import SendLocationModal from '@/Components/SendLocationModal';
import MessageRow from '@/Components/MessageRow';
import MessagesShell from '@/Components/MessagesShell';
import PinnedMessagesBar from '@/Components/PinnedMessagesBar';
import PinnedMessagesModal from '@/Components/PinnedMessagesModal';
import TypingIndicator from '@/Components/TypingIndicator';
import { formatChatSeparator, needsChatSeparator } from '@/lib/dates';
import { formatSize } from '@/lib/files';

// Same lists the server shows inline; anything else is a plain file chip.
const PREVIEWABLE_IMAGE = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PREVIEWABLE_VIDEO = ['video/mp4', 'video/quicktime', 'video/webm', 'video/ogg'];

const iconClass = 'h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400';

function PaperclipIcon() {
    return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
    );
}

function PinIcon() {
    return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

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
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
                ✕
            </button>
        </li>
    );
}

// The conversation itself (section 2). Keyed by conversation in Show, so opening
// another conversation starts it afresh: its own messages, composer and live
// connection.
function Chat({ conversation, messages: initialMessages, attachments: limits, moderation, contact, infoOpen, onToggleInfo, firstUnreadId }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const [fileProblems, setFileProblems] = useState([]);
    const [locationError, setLocationError] = useState(null);
    const [sendingLocation, setSendingLocation] = useState(false);
    const [pickingLocation, setPickingLocation] = useState(false);
    const [otherTyping, setOtherTyping] = useState(false);
    const bottomRef = useRef(null);
    const fileInput = useRef(null);
    const typingTimeout = useRef(null);
    const lastTypingWhisper = useRef(0);

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

        // Mark a long pause (or a new day) with a time label above the message
        // that follows it, and the very first message of the conversation.
        let previous = null;

        return result.map((group) => {
            const first = group.type === 'stack' ? group.messages[0] : group.message;
            const last = group.type === 'stack' ? group.messages[group.messages.length - 1] : group.message;
            const separator = needsChatSeparator(previous?.created_at, first.created_at)
                ? formatChatSeparator(first.created_at)
                : null;
            // Where the conversation stood when this page load opened it: the
            // "New messages" line goes above whichever group first carries that
            // message, and only there (it doesn't move as more arrive live).
            const hasUnreadDivider =
                firstUnreadId != null &&
                (group.type === 'stack'
                    ? group.messages.some((message) => message.id === firstUnreadId)
                    : group.message.id === firstUnreadId);

            previous = last;

            return { ...group, separator, hasUnreadDivider, isLastMessage: last.id === messages[messages.length - 1]?.id };
        });
    }, [messages, firstUnreadId]);

    // Keeps the list's preview and order up to date. "async" so it can't
    // interrupt a message that is being sent at the same moment.
    function refreshList() {
        router.reload({ only: ['conversations'], async: true });
    }

    // Live incoming messages
    useEcho(`conversation.${conversation.id}`, '.message.sent', (event) => {
        setMessages((current) => [...current, event]);
        setOtherTyping(false);
        refreshList();
    });

    // The other person edited a message, or pinned/unpinned one...
    useEcho(`conversation.${conversation.id}`, '.message.updated', (event) => {
        setMessages((current) =>
            current.map((message) =>
                message.id === event.id
                    ? {
                          ...message,
                          body: event.body,
                          edited_at: event.edited_at,
                          quote: event.quote ?? message.quote,
                          pinned_at: event.pinned_at,
                          pinned_by: event.pinned_by,
                      }
                    : message,
            ),
        );
        refreshList();
    });

    // The other person opened the conversation and read what we'd sent: flip
    // those bubbles from "Delivered" to "Seen". Filtering by sender protects
    // this from the mirror case, where we are the one who just read theirs.
    useEcho(`conversation.${conversation.id}`, '.messages.read', (event) => {
        setMessages((current) =>
            current.map((message) =>
                message.sender_id === auth.user.id && !message.read_at
                    ? { ...message, read_at: event.read_at }
                    : message,
            ),
        );
        refreshList();
    });

    // Typing is a whisper, not a database write: it never touches the server,
    // just the other browser's open tab, and fades on its own if nothing
    // follows. `channel()` is the same private channel `useEcho` subscribes
    // to above, so this reuses that one connection rather than opening another.
    const { channel } = useChannel(`conversation.${conversation.id}`);

    useEffect(() => {
        const ch = channel();
        if (!ch) return undefined;

        function onTyping() {
            setOtherTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
        }

        ch.listenForWhisper('typing', onTyping);

        return () => {
            ch.stopListeningForWhisper('typing', onTyping);
            clearTimeout(typingTimeout.current);
        };
    }, [channel]);

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

    // The typing bubble is the newest thing on screen when it shows up, same
    // as a real message would be, so it earns the same scroll.
    useEffect(() => {
        if (otherTyping) scrollToBottom();
    }, [otherTyping]);

    const { data, setData, post, processing, progress, reset, errors, clearErrors } = useForm({
        body: '',
        attachments: [],
        reply_to_id: '',
    });

    // What the composer shows above the input while replying: just enough to
    // build the quoted line, taken from the message actually on screen.
    const [replyingTo, setReplyingTo] = useState(null);

    function startReply(target) {
        setReplyingTo({
            id: target.id,
            sender_id: target.sender_id,
            sender_name: people[target.sender_id]?.name,
            preview: previewOf(target),
        });
        setData('reply_to_id', target.id);
    }

    function cancelReply() {
        setReplyingTo(null);
        setData('reply_to_id', '');
    }

    // For the pinned bar: only what's still visible to this person, most
    // recently pinned first (the bar itself does the sorting).
    const pinnedMessages = useMemo(
        () => messages.filter((message) => message.pinned_at && !message.deleted),
        [messages],
    );

    // The inline bar under the header only shows a short, scrollable strip;
    // this modal is the dedicated place to browse every pinned message.
    const [pinnedModalOpen, setPinnedModalOpen] = useState(false);

    function jumpToPinned(id) {
        const el = document.getElementById(`message-${id}`);
        if (!el) return;

        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400', 'rounded-lg');
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'rounded-lg'), 1200);
    }

    function unpinMessage(id) {
        router.post(route('messages.unpin', id), {}, { preserveScroll: true, onSuccess: (page) => setMessages(page.props.messages) });
    }

    // A short, client-side version of the same preview the server sends for
    // an already-sent reply's quoted line.
    function previewOf(target) {
        if (target.body) return target.body.length > 80 ? `${target.body.slice(0, 80)}…` : target.body;
        if (target.offer) return `Shared an offer: ${target.offer.title}`;
        if (target.request) return `Shared a request: ${target.request.excerpt}`;
        if (target.quote) return `Sent a quote: ${target.quote.price}`;
        if (target.location) return 'Shared a location';

        const files = target.attachments ?? [];
        if (files.length === 1) return 'Sent an attachment';
        if (files.length > 1) return `Sent ${files.length} attachments`;

        return null;
    }

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

    // Sends a chosen point as a location message.
    function postLocation({ lat, lng, label = null }) {
        setSendingLocation(true);

        router.post(
            route('messages.location.store', conversation.id),
            { lat, lng, ...(label ? { label } : {}) },
            {
                preserveScroll: true,
                onSuccess: (page) => {
                    setMessages(page.props.messages);
                    setPickingLocation(false);
                },
                onError: () => setLocationError('Your location could not be sent.'),
                onFinish: () => setSendingLocation(false),
            },
        );
    }

    // Throttled so holding a key down doesn't flood the socket: one whisper
    // is enough to keep the other side's indicator alive for a few seconds.
    function notifyTyping() {
        const now = Date.now();
        if (now - lastTypingWhisper.current < 2000) return;

        lastTypingWhisper.current = now;
        channel()?.whisper('typing', {});
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
                setReplyingTo(null);
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
                    pinnedCount={pinnedMessages.length}
                    onShowPinned={() => setPinnedModalOpen(true)}
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

            <PinnedMessagesBar
                messages={pinnedMessages}
                myId={auth.user.id}
                onJump={jumpToPinned}
                onUnpin={unpinMessage}
                onViewAll={() => setPinnedModalOpen(true)}
            />

            <PinnedMessagesModal
                show={pinnedModalOpen}
                onClose={() => setPinnedModalOpen(false)}
                messages={pinnedMessages}
                myId={auth.user.id}
                onJump={jumpToPinned}
                onUnpin={unpinMessage}
            />

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-4">
                {groups.map((group) => (
                    <Fragment key={group.key}>
                        {group.separator && (
                            <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">
                                {group.separator}
                            </p>
                        )}
                        {group.hasUnreadDivider && (
                            <div className="flex items-center gap-3 py-1" role="separator" aria-label="New messages">
                                <span className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                                <span className="shrink-0 text-xs font-medium text-indigo-500 dark:text-indigo-400">
                                    New messages
                                </span>
                                <span className="h-px flex-1 bg-indigo-200 dark:bg-indigo-800" />
                            </div>
                        )}
                        {group.type === 'stack' ? (
                            <MediaStackRow
                                messages={group.messages}
                                isMine={group.messages[0].sender_id === auth.user.id}
                                author={people[group.messages[0].sender_id]}
                                myId={auth.user.id}
                                otherName={otherParty.name}
                                reported={group.messages.some((message) =>
                                    moderation.reported_message_ids.includes(message.id),
                                )}
                                reasons={moderation.reasons}
                                onMessagesChange={setMessages}
                                onImageLoad={scrollToBottom}
                                onReply={startReply}
                                isLast={group.isLastMessage}
                            />
                        ) : (
                            <MessageRow
                                message={group.message}
                                isMine={group.message.sender_id === auth.user.id}
                                author={people[group.message.sender_id]}
                                myId={auth.user.id}
                                otherName={otherParty.name}
                                reported={moderation.reported_message_ids.includes(group.message.id)}
                                reasons={moderation.reasons}
                                onMessagesChange={setMessages}
                                onImageLoad={scrollToBottom}
                                onReply={startReply}
                                isLast={group.isLastMessage}
                            />
                        )}
                    </Fragment>
                ))}
                {otherTyping && <TypingIndicator author={otherParty} />}
                <div ref={bottomRef} />
            </div>

            {conversation.is_request && (
                <p className="border-t border-gray-200 bg-indigo-50 px-4 py-2 text-xs text-indigo-800 dark:border-gray-700 dark:bg-indigo-900/20 dark:text-indigo-200">
                    {conversation.is_restricted
                        ? `You restricted ${otherParty.name}. Their messages wait here without notifying you until you unrestrict them.`
                        : 'This is a new request. Reply to move it to your inbox.'}
                </p>
            )}

            {contact.can_message === false ? (
                // Blocked, by either of them: the history stays readable but nobody can write.
                <p className="border-t border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                    {contact.relations?.blocked
                        ? `You blocked ${otherParty.name}. Unblock them from the panel on the right to write again.`
                        : 'You can no longer send messages in this conversation.'}
                </p>
            ) : (
            <form onSubmit={submit} className="border-t border-gray-200 p-3 dark:border-gray-700">
                {replyingTo && (
                    <div className="mb-2 flex items-start gap-2 rounded-md bg-gray-50 px-3 py-1.5 dark:bg-gray-900/40">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                Replying to {replyingTo.sender_id === auth.user.id ? 'yourself' : otherParty.name}
                            </p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {replyingTo.preview ?? 'Attachment'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={cancelReply}
                            aria-label="Cancel reply"
                            className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            ✕
                        </button>
                    </div>
                )}
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
                    <Menu as="div" className="relative">
                        <MenuButton
                            title="Attach"
                            aria-label="Attach a file or a location"
                            disabled={sendingLocation}
                            className="h-full rounded-md bg-gray-100 px-3 py-2 text-lg leading-none text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            {sendingLocation ? '…' : '+'}
                        </MenuButton>
                        <MenuItems
                            anchor="top start"
                            className="z-50 w-56 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:8px] focus:outline-none dark:bg-gray-700"
                        >
                            <MenuItem>
                                <button
                                    type="button"
                                    onClick={() => fileInput.current?.click()}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800"
                                >
                                    <PaperclipIcon /> Attach files
                                </button>
                            </MenuItem>
                            <MenuItem>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationError(null);
                                        setPickingLocation(true);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800"
                                >
                                    <PinIcon /> Share location
                                </button>
                            </MenuItem>
                        </MenuItems>
                    </Menu>
                    <input
                        type="text"
                        value={data.body}
                        onChange={(e) => {
                            setData('body', e.target.value);
                            notifyTyping();
                        }}
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
            )}

            <SendLocationModal
                show={pickingLocation}
                sending={sendingLocation}
                error={locationError}
                onClose={() => setPickingLocation(false)}
                onSend={postLocation}
            />
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

export default function Show({ conversation, conversations, contact, messages, attachments, moderation, first_unread_id }) {
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
            info={
                <ConversationInfo
                    contact={contact}
                    open={infoOpen}
                    onClose={() => changeInfo(false)}
                    reasons={moderation.reasons}
                />
            }
        >
            <Chat
                key={conversation.id}
                conversation={conversation}
                messages={messages}
                attachments={attachments}
                moderation={moderation}
                contact={contact}
                infoOpen={infoOpen}
                onToggleInfo={() => changeInfo(!infoOpen)}
                firstUnreadId={first_unread_id}
            />
        </MessagesShell>
    );
}

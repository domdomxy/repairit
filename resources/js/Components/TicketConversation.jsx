import InputError from '@/Components/InputError';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import SupportThread from '@/Components/SupportThread';
import { XIcon } from '@/Components/Icons';
import { formatDateTime } from '@/lib/dates';
import { formatSize } from '@/lib/files';
import { addPictures, serverPictureProblems } from '@/lib/support';
import useAutoGrow from '@/lib/useAutoGrow';
import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

/**
 * How tall the conversation card is. From the lg breakpoint it fills the space
 * its page gives it (the page itself does not scroll, only the messages inside
 * the card do); below that it is a tall card and the page scrolls around it.
 */
export const TICKET_CARD_FILL = 'h-[calc(100dvh-7rem)] min-h-[28rem] lg:h-full lg:min-h-0';

const COMPOSER_MAX_PX = 160;

// One picture waiting to be sent: a small thumbnail with a remove button. The
// preview is a temporary browser URL, made when it appears and let go of when it is removed.
function PendingPicture({ file, rejected, onRemove }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <li
            title={`${file.name} · ${formatSize(file.size)}`}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md ring-1 ${
                rejected ? 'ring-2 ring-red-400' : 'ring-gray-900/10 dark:ring-white/10'
            }`}
        >
            {url && <img src={url} alt={file.name} className="h-full w-full object-cover" />}
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white transition hover:bg-black/80"
            >
                <XIcon className="h-3 w-3" />
            </button>
        </li>
    );
}

/**
 * The bottom of a ticket, laid out like the chat page's: a "+" for pictures, one
 * field that grows as you write (Enter sends, Shift+Enter starts a new line) and
 * a Send button. `form` is the useForm() object with a `body` field, and an
 * `attachments` field (an array of files) when `attachmentLimits` is given.
 * `extra` is a small row above the field (the admin's "then set status to").
 */
function Composer({ form, onSubmit, onTyping, attachmentLimits, placeholder, extra }) {
    const { data, setData, processing, errors, progress } = form;
    const formRef = useRef(null);
    const field = useRef(null);
    const fileInput = useRef(null);
    const [problems, setProblems] = useState([]);

    const pictures = attachmentLimits ? (data.attachments ?? []) : [];
    const hasPictures = pictures.length > 0;
    const canSend = !processing && (data.body.trim() !== '' || hasPictures);

    // Grows with what is written, up to a few lines, and shrinks back after sending.
    useAutoGrow(field, data.body, COMPOSER_MAX_PX);

    function pick(e) {
        const picked = Array.from(e.target.files ?? []);
        // Clear the input so choosing the same picture again still fires onChange.
        e.target.value = '';

        const result = addPictures(pictures, picked, attachmentLimits);

        setProblems(result.complaints);
        setData('attachments', result.files);
    }

    function submit(e) {
        e.preventDefault();

        if (canSend) onSubmit(e);
    }

    const { rejected, messages: serverProblems } = attachmentLimits
        ? serverPictureProblems(errors, pictures)
        : { rejected: new Set(), messages: [] };
    const shown = [...new Set([...problems, ...serverProblems])];

    return (
        <form ref={formRef} onSubmit={submit} className="shrink-0 border-t border-gray-200 p-3 dark:border-gray-700">
            {extra}

            {hasPictures && (
                <ul className="mb-2 flex gap-2 overflow-x-auto pb-1">
                    {pictures.map((file, index) => (
                        <PendingPicture
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            file={file}
                            rejected={rejected.has(index)}
                            onRemove={() =>
                                setData(
                                    'attachments',
                                    pictures.filter((_, position) => position !== index),
                                )
                            }
                        />
                    ))}
                </ul>
            )}

            {(shown.length > 0 || errors.body || errors.status) && (
                <div className="mb-2 space-y-1 text-sm text-red-600">
                    {shown.map((problem) => (
                        <p key={problem}>{problem}</p>
                    ))}
                    <InputError message={errors.body} />
                    <InputError message={errors.status} />
                </div>
            )}

            <div className="flex items-end gap-2">
                {attachmentLimits && (
                    <>
                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            accept={attachmentLimits.extensions.map((extension) => `.${extension}`).join(',')}
                            onChange={pick}
                            className="hidden"
                        />
                        <button
                            type="button"
                            title="Attach pictures"
                            aria-label="Attach pictures"
                            disabled={pictures.length >= attachmentLimits.max_files}
                            onClick={() => fileInput.current?.click()}
                            className="h-[42px] shrink-0 rounded-md bg-gray-100 px-3 text-lg leading-none text-gray-700 hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            +
                        </button>
                    </>
                )}
                <textarea
                    ref={field}
                    rows={1}
                    maxLength={5000}
                    value={data.body}
                    aria-label="Reply"
                    placeholder={placeholder}
                    onChange={(e) => {
                        setData('body', e.target.value);
                        onTyping?.();
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            formRef.current?.requestSubmit();
                        }
                    }}
                    className="min-w-0 flex-1 resize-none overflow-y-hidden rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-900"
                />
                <button
                    type="submit"
                    disabled={!canSend}
                    className="h-[42px] shrink-0 rounded-md bg-indigo-600 px-4 text-white disabled:opacity-50"
                >
                    {processing && hasPictures && progress ? `${progress.percentage}%` : 'Send'}
                </button>
            </div>
        </form>
    );
}

/**
 * A ticket's conversation as one card, the way the chat page is laid out: the
 * ticket's title and status on top, the messages in the middle (the only part
 * that scrolls) and the reply field at the bottom.
 *
 * - `ticket`: subject, tracking_id, category_label, created_at, status.
 * - `backHref` / `backLabel`: the link above the title (left out when null).
 * - `headerActions`: extra buttons beside the status badge.
 * - `notice`: shown instead of the reply field (a closed ticket).
 * - `form`, `onSubmit`, `onTyping`, `attachmentLimits`, `composerExtra`: the reply field (see Composer).
 * - `className`: the card's size, usually TICKET_CARD_FILL.
 */
export default function TicketConversation({
    ticket,
    thread,
    viewerIsStaff,
    firstUnreadId = null,
    typing = false,
    typingAuthor = null,
    backHref = null,
    backLabel = 'All tickets',
    headerActions = null,
    notice = null,
    form,
    onSubmit,
    onTyping = null,
    attachmentLimits = null,
    composerExtra = null,
    placeholder = 'Type a message...',
    className = TICKET_CARD_FILL,
}) {
    const scroller = useRef(null);

    return (
        <section className={`flex min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800 ${className}`}>
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="min-w-0">
                    {backHref && (
                        <Link
                            href={backHref}
                            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            {backLabel}
                        </Link>
                    )}
                    <h1 className="truncate text-lg font-semibold">{ticket.subject}</h1>
                    <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-mono">{ticket.tracking_id}</span> · {ticket.category_label} · Opened{' '}
                        {formatDateTime(ticket.created_at)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {headerActions}
                    <SupportStatusBadge status={ticket.status} />
                </div>
            </header>

            {/* The only part of the page that scrolls. */}
            <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
                <SupportThread
                    thread={thread}
                    viewerIsStaff={viewerIsStaff}
                    firstUnreadId={firstUnreadId}
                    typing={typing}
                    typingAuthor={typingAuthor}
                    scrollRef={scroller}
                />
            </div>

            {notice ? (
                <p className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                    {notice}
                </p>
            ) : (
                <Composer
                    form={form}
                    onSubmit={onSubmit}
                    onTyping={onTyping}
                    attachmentLimits={attachmentLimits}
                    placeholder={placeholder}
                    extra={composerExtra}
                />
            )}
        </section>
    );
}

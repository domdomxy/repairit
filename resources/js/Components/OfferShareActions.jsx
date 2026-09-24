import Avatar from '@/Components/Avatar';
import { ChatIcon, XIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// Puts text on the clipboard. The modern API needs a secure page (https or
// localhost), so a hidden text field and the old copy command are the fallback.
export async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the fallback below
    }

    try {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(field);

        return copied;
    } catch {
        return false;
    }
}

// Copies the link to an offer. When nothing works the link is shown instead, so
// it can be copied by hand. Resolves to whether it ended up on the clipboard.
export async function copyOfferLink(offer) {
    const url = route('offers.show', offer.id);

    if (await copyText(url)) {
        return true;
    }

    window.prompt('Copy this link:', url);

    return false;
}

// The two ways to share an offer: send it in the chat with its technician (as a
// card they can open), or copy its link. Your own offers can only be copied:
// there is nobody to send them to. `showCopy` is off where the link lives in a
// menu instead (the feed).
export default function OfferShareActions({ offer, technicianId, technician = null, showCopy = true, className = '' }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === technicianId;
    // Who the offer goes to: the offer's own technician, or the one the page passes in.
    const recipient = offer.technician ?? technician;

    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const [composing, setComposing] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    async function copyLink() {
        if (!(await copyOfferLink(offer))) return;

        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }

    // The offer goes as a card; the note is optional and travels with it.
    function sendInChat(event) {
        event?.preventDefault();

        router.post(route('offers.share', offer.id), { message: note }, {
            onStart: () => {
                setSending(true);
                setError('');
            },
            onError: (errors) => setError(errors.message ?? 'The offer could not be sent.'),
            onSuccess: () => {
                setComposing(false);
                setNote('');
            },
            onFinish: () => setSending(false),
        });
    }

    // Nothing to show: your own offer, with the link kept in the menu.
    if (isOwn && !showCopy) return null;

    return (
        <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
            {!isOwn && (
                <button
                    type="button"
                    onClick={() => setComposing(true)}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700"
                >
                    Send in chat
                </button>
            )}
            {!isOwn && (
                <Modal
                    show={composing}
                    onClose={() => !sending && setComposing(false)}
                    maxWidth="md"
                    backdrop="bg-gray-900/50 backdrop-blur-sm"
                    panelClassName="rounded-2xl bg-white shadow-xl ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10"
                >
                    <form onSubmit={sendInChat}>
                        <div className="flex items-start justify-between gap-4 px-6 pt-6">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-indigo-600 ring-1 ring-indigo-200 dark:text-indigo-300 dark:ring-indigo-500/40">
                                    <ChatIcon className="h-5 w-5" />
                                </span>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Send offer in chat</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {recipient ? (
                                            <>
                                                To <bdi>{recipient.name}</bdi>, as a card they can open.
                                            </>
                                        ) : (
                                            'Sent as a card they can open.'
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setComposing(false)}
                                disabled={sending}
                                aria-label="Close"
                                className="-me-2 -mt-2 rounded-md p-2 text-gray-400 transition hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-5 px-6 py-5">
                            {/* What is being sent, the way it will look. */}
                            <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                                {recipient && <Avatar user={recipient} size="sm" />}
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{offer.title}</p>
                                    {recipient && (
                                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{recipient.name}</p>
                                    )}
                                </div>
                                {offer.price && (
                                    <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 dark:text-indigo-200 dark:ring-indigo-500/40">
                                        {offer.price}
                                    </span>
                                )}
                            </div>

                            <div>
                                <div className="flex items-baseline justify-between">
                                    <label htmlFor={`offer-note-${offer.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Message <span className="font-normal text-gray-500">(optional)</span>
                                    </label>
                                    {note.length > 4000 && (
                                        <span className="text-xs text-gray-500">{note.length} / 5000</span>
                                    )}
                                </div>
                                <textarea
                                    id={`offer-note-${offer.id}`}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Ctrl or Cmd + Enter sends, like the chat's own field.
                                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !sending) sendInChat(e);
                                    }}
                                    rows={4}
                                    maxLength={5000}
                                    autoFocus
                                    placeholder="Say hello, or what you would like to know about this offer..."
                                    className="mt-1.5 block w-full resize-none rounded-xl border-gray-300 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                />
                                {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-700">
                            <span className="hidden text-xs text-gray-400 sm:block">Ctrl + Enter to send</span>
                            <div className="ms-auto flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setComposing(false)}
                                    disabled={sending}
                                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sending}
                                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {sending ? 'Sending…' : 'Send offer'}
                                </button>
                            </div>
                        </div>
                    </form>
                </Modal>
            )}
            {showCopy && (
                <>
                    <button
                        type="button"
                        onClick={copyLink}
                        className="rounded-md bg-gray-100 px-3 py-1.5 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                    >
                        {copied ? '✓ Link copied' : 'Copy link'}
                    </button>
                    <span className="sr-only" role="status">
                        {copied ? 'Link copied' : ''}
                    </span>
                </>
            )}
        </div>
    );
}

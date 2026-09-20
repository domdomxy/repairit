import Modal from '@/Components/Modal';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// Puts text on the clipboard. The modern API needs a secure page (https or
// localhost), so a hidden text field and the old copy command are the fallback.
async function copyText(text) {
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
export default function OfferShareActions({ offer, technicianId, showCopy = true, className = '' }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === technicianId;

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
                <Modal show={composing} onClose={() => !sending && setComposing(false)} maxWidth="md">
                    <form onSubmit={sendInChat} className="space-y-4 p-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Send offer in chat</h3>
                            <p className="mt-1 truncate text-sm text-gray-500">{offer.title}</p>
                        </div>
                        <div>
                            <label htmlFor={`offer-note-${offer.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Message <span className="font-normal text-gray-500">(optional)</span>
                            </label>
                            <textarea
                                id={`offer-note-${offer.id}`}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={4}
                                maxLength={5000}
                                placeholder="Add a message to send with this offer"
                                className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                            />
                            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setComposing(false)}
                                disabled={sending}
                                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={sending}
                                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {sending ? 'Sending…' : 'Send'}
                            </button>
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

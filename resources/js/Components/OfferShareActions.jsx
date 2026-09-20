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

// The two ways to share an offer: send it in the chat with its technician (as a
// card they can open), or copy its link. Your own offers can only be copied:
// there is nobody to send them to.
export default function OfferShareActions({ offer, technicianId, className = '' }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === technicianId;

    const [copied, setCopied] = useState(false);
    const [sending, setSending] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    async function copyLink() {
        const url = route('offers.show', offer.id);

        if (!(await copyText(url))) {
            // Nothing worked: show the link so it can be copied by hand.
            window.prompt('Copy this link:', url);
            return;
        }

        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }

    function sendInChat() {
        router.post(route('offers.share', offer.id), {}, {
            onStart: () => setSending(true),
            onFinish: () => setSending(false),
        });
    }

    return (
        <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
            {!isOwn && (
                <button
                    type="button"
                    onClick={sendInChat}
                    disabled={sending}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {sending ? 'Sending…' : 'Send in chat'}
                </button>
            )}
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
        </div>
    );
}

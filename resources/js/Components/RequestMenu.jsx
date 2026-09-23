import Dropdown from '@/Components/Dropdown';
import Modal from '@/Components/Modal';
import { copyText } from '@/Components/OfferShareActions';
import ReportModal from '@/Components/ReportModal';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const ITEM =
    'block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:bg-gray-800';

// Copies the link to a request. When nothing works the link is shown instead, so
// it can be copied by hand. Resolves to whether it ended up on the clipboard.
async function copyRequestLink(request) {
    const url = route('requests.show', request.id);

    if (await copyText(url)) {
        return true;
    }

    window.prompt('Copy this link:', url);

    return false;
}

// The "..." menu at the top right of a repair request, the same one an offer
// has: copy its link, send it in the chat with the customer who posted it (a
// technician, for a request that is not theirs), edit or delete it (your own,
// when `onEdit` / `onDelete` are given) or report it (somebody else's, when
// report `reasons` are given).
// `request.customer` is the public card the server sends with each request.
export default function RequestMenu({ request, reasons, onEdit, onDelete }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === request.customer.id;
    const canReport = !isOwn && Boolean(reasons);
    // Sending a request in the chat is how a technician gets in touch about it.
    const canSend = !isOwn && auth.user.role === 'technician';

    const [copied, setCopied] = useState(false);
    const [reporting, setReporting] = useState(false);
    const [composing, setComposing] = useState(false);
    const [sending, setSending] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    // The menu closes as soon as an item is picked, so the confirmation is
    // shown next to the button for a moment instead of inside the menu.
    async function copyLink() {
        if (!(await copyRequestLink(request))) return;

        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }

    // The request goes as a card; the note is optional and travels with it.
    function sendInChat(event) {
        event.preventDefault();

        router.post(route('requests.share', request.id), { message: note }, {
            onStart: () => {
                setSending(true);
                setError('');
            },
            onError: (errors) => setError(errors.message ?? 'The request could not be sent.'),
            onSuccess: () => {
                setComposing(false);
                setNote('');
            },
            onFinish: () => setSending(false),
        });
    }

    return (
        <div className="flex items-center gap-1">
            <span role="status" className={copied ? 'text-xs text-green-600 dark:text-green-400' : 'sr-only'}>
                {copied ? '✓ Link copied' : ''}
            </span>

            <Dropdown>
                <Dropdown.Trigger>
                    <button
                        type="button"
                        aria-label="Request options"
                        className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        ⋯
                    </button>
                </Dropdown.Trigger>

                <Dropdown.Content contentClasses="border border-gray-200 py-1 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <button type="button" onClick={copyLink} className={ITEM}>
                        Copy link
                    </button>

                    {canSend && (
                        <button type="button" onClick={() => setComposing(true)} className={ITEM}>
                            Send in chat
                        </button>
                    )}

                    {isOwn && onEdit && (
                        <button type="button" onClick={onEdit} className={ITEM}>
                            Edit request
                        </button>
                    )}

                    {isOwn && onDelete && (
                        <button type="button" onClick={onDelete} className={`${ITEM} text-red-600 dark:text-red-400`}>
                            Delete request
                        </button>
                    )}

                    {canReport && (
                        <button
                            type="button"
                            onClick={() => setReporting(true)}
                            className={`${ITEM} text-red-600 dark:text-red-400`}
                        >
                            Report request
                        </button>
                    )}
                </Dropdown.Content>
            </Dropdown>

            {canSend && (
                <Modal show={composing} onClose={() => !sending && setComposing(false)} maxWidth="md">
                    <form onSubmit={sendInChat} className="space-y-4 p-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Send request in chat</h3>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{request.excerpt}</p>
                            <p className="mt-1 text-sm text-gray-500">It goes to your chat with {request.customer.name}.</p>
                        </div>
                        <div>
                            <label htmlFor={`request-note-${request.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Message <span className="font-normal text-gray-500">(optional)</span>
                            </label>
                            <textarea
                                id={`request-note-${request.id}`}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                rows={4}
                                maxLength={5000}
                                placeholder="Add a message to send with this request"
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

            {canReport && (
                <ReportModal
                    show={reporting}
                    onClose={() => setReporting(false)}
                    title="Report this request"
                    description={`Tell the admins what is wrong with this request by ${request.customer.name}. ${request.customer.name} is not told who reported it.`}
                    action={route('requests.report', request.id)}
                    reasons={reasons}
                />
            )}
        </div>
    );
}

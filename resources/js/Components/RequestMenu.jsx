import Dropdown from '@/Components/Dropdown';
import { copyText } from '@/Components/OfferShareActions';
import ReportModal from '@/Components/ReportModal';
import { usePage } from '@inertiajs/react';
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
// has: copy its link, edit or delete it (your own, when `onEdit` / `onDelete`
// are given) or report it (somebody else's, when report `reasons` are given).
// `request.customer` is the public card the server sends with each request.
export default function RequestMenu({ request, reasons, onEdit, onDelete }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === request.customer.id;
    const canReport = !isOwn && Boolean(reasons);

    const [copied, setCopied] = useState(false);
    const [reporting, setReporting] = useState(false);
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

                <Dropdown.Content>
                    <button type="button" onClick={copyLink} className={ITEM}>
                        Copy link
                    </button>

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

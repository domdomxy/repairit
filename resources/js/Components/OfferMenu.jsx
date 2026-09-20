import Dropdown from '@/Components/Dropdown';
import { copyOfferLink } from '@/Components/OfferShareActions';
import ReportModal from '@/Components/ReportModal';
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const ITEM =
    'block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 transition hover:bg-gray-100 focus:bg-gray-100 focus:outline-none dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:bg-gray-800';

// The "..." menu at the top right of a listed offer: copy its link, or report
// it. Your own offers can only have their link copied, as with messages: you
// report what somebody else made. `offer.technician` is the public card the
// server sends with each offer.
export default function OfferMenu({ offer, reasons }) {
    const { auth } = usePage().props;
    const isOwn = auth.user.id === offer.technician.id;

    const [copied, setCopied] = useState(false);
    const [reporting, setReporting] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    // The menu closes as soon as an item is picked, so the confirmation is
    // shown next to the button for a moment instead of inside the menu.
    async function copyLink() {
        if (!(await copyOfferLink(offer))) return;

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
                        aria-label="Offer options"
                        className="rounded-md px-2 py-1 text-xl leading-none text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                    >
                        ⋯
                    </button>
                </Dropdown.Trigger>

                <Dropdown.Content>
                    <button type="button" onClick={copyLink} className={ITEM}>
                        Copy link
                    </button>

                    {!isOwn && (
                        <button
                            type="button"
                            onClick={() => setReporting(true)}
                            className={`${ITEM} text-red-600 dark:text-red-400`}
                        >
                            Report offer
                        </button>
                    )}
                </Dropdown.Content>
            </Dropdown>

            {!isOwn && (
                <ReportModal
                    show={reporting}
                    onClose={() => setReporting(false)}
                    title="Report this offer"
                    description={`Tell the admins what is wrong with "${offer.title}" by ${offer.technician.name}. ${offer.technician.name} is not told who reported it.`}
                    action={route('offers.report', offer.id)}
                    reasons={reasons}
                />
            )}
        </div>
    );
}

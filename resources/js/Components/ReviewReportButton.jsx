import ReportModal from '@/Components/ReportModal';
import { useState } from 'react';

// A small "Report" link under a review somebody else wrote, opening the same
// form as reporting a message or an offer. `action` is the route to post to
// (a review of a technician, or of a customer); the page decides whom to show
// it to, so nobody is offered a report button on their own review.
export default function ReviewReportButton({ action, reasons, authorName }) {
    const [open, setOpen] = useState(false);

    if (!reasons) return null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-2 text-xs text-gray-500 hover:text-red-600 hover:underline dark:text-gray-400 dark:hover:text-red-400"
            >
                Report
            </button>

            <ReportModal
                show={open}
                onClose={() => setOpen(false)}
                title="Report this review"
                description={`Tell the admins what is wrong with this review by ${authorName}. ${authorName} is not told who reported it.`}
                action={action}
                reasons={reasons}
            />
        </>
    );
}

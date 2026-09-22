import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { formatDateTime } from '@/lib/dates';

// "Delivered" is when the message reached the server (there is no separate
// hand-off step to time in a web chat); "Seen" is when the other person's
// unread count cleared it, or "–" if that has not happened yet.
export default function MessageDetailsModal({ show, onClose, message }) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Message details</h2>

                <dl className="mt-4 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                    <div className="flex items-center justify-between gap-4 py-2">
                        <dt className="text-gray-500 dark:text-gray-400">Delivered</dt>
                        <dd className="text-gray-900 dark:text-gray-100">{formatDateTime(message?.created_at)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 py-2">
                        <dt className="text-gray-500 dark:text-gray-400">Seen</dt>
                        <dd className="text-gray-900 dark:text-gray-100">
                            {message?.read_at ? formatDateTime(message.read_at) : '–'}
                        </dd>
                    </div>
                </dl>

                <div className="mt-6 flex justify-end">
                    <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                </div>
            </div>
        </Modal>
    );
}

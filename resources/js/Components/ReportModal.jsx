import InputError from '@/Components/InputError';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm } from '@inertiajs/react';

// Asks why something is being reported and sends it to the admins. Used for a
// single message and for a whole conversation: only `action` (the route to post
// to) and the wording differ.
export default function ReportModal({ show, onClose, title, description, action, reasons }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        reason: '',
        details: '',
    });

    function close() {
        onClose();
        reset();
        clearErrors();
    }

    function submit(e) {
        e.preventDefault();

        post(action, { preserveScroll: true, onSuccess: close });
    }

    return (
        <Modal show={show} onClose={close} maxWidth="md">
            <form onSubmit={submit} className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>

                <fieldset className="mt-5 space-y-2">
                    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</legend>
                    {Object.entries(reasons).map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                            <input
                                type="radio"
                                name="reason"
                                value={value}
                                checked={data.reason === value}
                                onChange={() => setData('reason', value)}
                                className="text-indigo-600 focus:ring-indigo-500"
                            />
                            {label}
                        </label>
                    ))}
                    <InputError message={errors.reason} />
                </fieldset>

                <div className="mt-4">
                    <label htmlFor="report-details" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        More details <span className="font-normal text-gray-500">(optional)</span>
                    </label>
                    <textarea
                        id="report-details"
                        rows={3}
                        maxLength={1000}
                        value={data.details}
                        onChange={(e) => setData('details', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                    />
                    <InputError message={errors.details} />
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={close}>Cancel</SecondaryButton>
                    <button
                        type="submit"
                        disabled={processing || data.reason === ''}
                        className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-red-500 disabled:opacity-40"
                    >
                        Send report
                    </button>
                </div>
            </form>
        </Modal>
    );
}

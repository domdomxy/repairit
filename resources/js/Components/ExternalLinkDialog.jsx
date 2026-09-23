import Checkbox from '@/Components/Checkbox';
import Modal from '@/Components/Modal';

// Splits an address into what comes before the host name, the host name, and
// the rest, so the host (the part that says where you are really going) can be
// set in heavier type than the path and query around it.
function splitUrl(url, hostname) {
    if (!url || !hostname) return { prefix: '', host: '', rest: url ?? '' };

    const at = url.indexOf(hostname);
    if (at === -1) return { prefix: '', host: '', rest: url };

    return { prefix: url.slice(0, at), host: hostname, rest: url.slice(at + hostname.length) };
}

// The "Leaving Repairit" prompt: where the link goes, an optional "trust this
// site" tick, and a choice between going back and visiting. `canTrust` is off
// for someone who is not signed in, since there is no account to remember it on.
export default function ExternalLinkDialog({
    open,
    hostname,
    url,
    canTrust,
    trustChecked,
    onTrustChange,
    onConfirm,
    onCancel,
}) {
    const { prefix, host, rest } = splitUrl(url, hostname);

    return (
        <Modal show={!!open} onClose={onCancel} maxWidth="md" backdrop="bg-black/55 dark:bg-black/70">
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Leaving Repairit</h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            This link is taking you to another website.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close"
                        className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                <div
                    className="mt-4 break-all rounded-lg border border-gray-300 bg-gray-50 px-3.5 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900/60"
                    title={url}
                >
                    <span className="text-gray-500 dark:text-gray-400">{prefix}</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{host}</span>
                    <span className="text-gray-500 dark:text-gray-400">{rest}</span>
                </div>

                {canTrust && (
                    <label
                        className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition ${
                            trustChecked
                                ? 'border-indigo-300 bg-indigo-50/70 dark:border-indigo-500/40 dark:bg-indigo-950/30'
                                : 'border-gray-200 bg-gray-50/60 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:bg-gray-800/60'
                        }`}
                    >
                        <Checkbox
                            checked={trustChecked}
                            onChange={(e) => onTrustChange(e.target.checked)}
                            className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 text-sm text-gray-600 dark:text-gray-300">
                            Trust <span className="break-all font-semibold text-gray-900 dark:text-gray-100">{hostname}</span>{' '}
                            links from now on
                            <span className="mt-0.5 block text-xs text-gray-400 dark:text-gray-500">
                                Skips this prompt for {hostname} next time. You can manage trusted sites in Settings.
                            </span>
                        </span>
                    </label>
                )}

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        autoFocus
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus-visible:ring-offset-gray-800"
                    >
                        Go back
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
                    >
                        Visit site
                    </button>
                </div>
            </div>
        </Modal>
    );
}

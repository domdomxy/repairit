import MessageAttachments from '@/Components/MessageAttachments';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import { formatDateTime, relativeTime } from '@/lib/dates';

// Everything that happened to a repair, newest first: the status at the time,
// when, what the technician wrote, and the files they attached. The newest
// entry is marked.
export default function RepairTimeline({ updates }) {
    return (
        <ol className="space-y-6 border-l-2 border-gray-100 pl-6 dark:border-gray-700">
            {updates.map((update, index) => (
                <li key={update.id} className="relative">
                    <span
                        aria-hidden="true"
                        className={`absolute -left-[33px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-800 ${
                            index === 0 ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <RepairStatusBadge status={update.status} label={update.status_label} />
                        {index === 0 && (
                            <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                Latest
                            </span>
                        )}
                        <time
                            dateTime={update.created_at}
                            title={formatDateTime(update.created_at)}
                            className="text-xs text-gray-500 dark:text-gray-400"
                        >
                            {formatDateTime(update.created_at)} · {relativeTime(update.created_at)}
                        </time>
                    </div>
                    {update.note && (
                        <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                            {update.note}
                        </p>
                    )}
                    {update.attachments?.length > 0 && (
                        <div className="mt-2 max-w-md">
                            <MessageAttachments
                                attachments={update.attachments}
                                className="text-sm text-gray-700 dark:text-gray-300"
                            />
                        </div>
                    )}
                </li>
            ))}
        </ol>
    );
}

import RepairStatusBadge from '@/Components/RepairStatusBadge';
import { formatDateTime } from '@/lib/dates';

// Everything that happened to a repair, newest first: the status at the time,
// when, and what the technician wrote.
export default function RepairTimeline({ updates }) {
    return (
        <ol className="space-y-6 border-l border-gray-200 pl-6 dark:border-gray-700">
            {updates.map((update, index) => (
                <li key={update.id} className="relative">
                    <span
                        aria-hidden="true"
                        className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-800 ${
                            index === 0 ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        <RepairStatusBadge status={update.status} label={update.status_label} />
                        <time dateTime={update.created_at} className="text-xs text-gray-500">
                            {formatDateTime(update.created_at)}
                        </time>
                    </div>
                    {update.note && (
                        <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-700 dark:text-gray-300">
                            {update.note}
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}

import Avatar from '@/Components/Avatar';
import { relativeTime } from '@/lib/dates';
import { Link } from '@inertiajs/react';

// A repair request as a card in a list: who is asking, what for, roughly how
// much they would spend and how many quotes it has. The whole card opens the
// request. `scope` is 'mine' on the customer's own list, where the status
// matters more than the name.
export default function RequestCard({ request, scope = 'all' }) {
    return (
        <Link
            href={route('requests.show', request.id)}
            className="block space-y-3 rounded-lg bg-white p-4 shadow transition hover:shadow-md dark:bg-gray-800"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={request.customer} size="sm" />
                    <p className="min-w-0 truncate text-sm text-gray-500">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                            {scope === 'mine' ? 'You' : request.customer.name}
                        </span>
                        {request.city && <> · {request.city}</>} · {relativeTime(request.created_at)}
                    </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {request.has_my_quote && (
                        <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                            You sent a quote
                        </span>
                    )}
                    {request.status === 'closed' && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            Closed
                        </span>
                    )}
                </div>
            </div>

            <div>
                <h3 className="break-words font-semibold">{request.title}</h3>
                <p className="mt-1 line-clamp-3 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
                    {request.description}
                </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    {request.categories.map((category) => (
                        <span
                            key={category.id}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                        >
                            {category.name}
                        </span>
                    ))}
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500">
                    {request.budget && (
                        <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                            Budget: {request.budget}
                        </span>
                    )}
                    <span>
                        {request.quotes_count} quote{request.quotes_count === 1 ? '' : 's'}
                    </span>
                </div>
            </div>
        </Link>
    );
}

import { Link } from '@inertiajs/react';

// A repair request sent in the chat, as a card that opens the request. If the
// customer has deleted the request since, only the start of its text is left.
export default function SharedRequestCard({ request, onImageLoad }) {
    if (!request.url) {
        return (
            <div className="w-64 max-w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                <p className="italic">This request is no longer available</p>
                <p className="mt-1 line-clamp-2">{request.excerpt}</p>
            </div>
        );
    }

    return (
        <Link
            href={request.url}
            className="block w-64 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm transition hover:shadow dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
            {request.image_url && (
                <img src={request.image_url} alt="" loading="lazy" onLoad={onImageLoad} className="h-32 w-full object-cover" />
            )}
            <div className="space-y-0.5 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Repair request{request.status === 'closed' && ' · Closed'}
                </p>
                <p className="line-clamp-3 whitespace-pre-line break-words text-sm">{request.excerpt}</p>
                {request.city && <p className="text-xs text-gray-500 dark:text-gray-400">{request.city}</p>}
                {request.budget && <p className="text-sm text-indigo-600 dark:text-indigo-300">Budget: {request.budget}</p>}
                <p className="pt-1 text-xs text-indigo-600 dark:text-indigo-400">View request →</p>
            </div>
        </Link>
    );
}

import Avatar from '@/Components/Avatar';
import FeedKindBadge from '@/Components/FeedKindBadge';
import PostMedia from '@/Components/PostMedia';
import { relativeTime } from '@/lib/dates';
import { Link } from '@inertiajs/react';

// A repair request as a card in a list: who is asking, what for, roughly how
// much they would spend and how many quotes it has. The whole card opens the
// request (its text is a link stretched over the card), so the `menu` at the
// top right (RequestMenu: copy link, edit, delete, report) sits above that link.
// `scope` is 'mine' on the customer's own list, where the status
// matters more than the name. In the feed, `showKind` marks it as a request
// among the offers, and `className` gives it the look of the offers' cards.
// On the customer's own profile, `showAuthor` is off: the page already says who.
// Pictures and videos attached to the request are stacked as a collage (PostMedia),
// the same as an offer's; a click on one opens them in a viewer to browse.
export default function RequestCard({
    request,
    scope = 'all',
    showKind = false,
    showAuthor = true,
    menu = null,
    className = 'rounded-lg bg-white shadow transition hover:shadow-md dark:bg-gray-800',
}) {
    return (
        <div className={`relative space-y-3 p-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {showAuthor && <Avatar user={request.customer} size="sm" />}
                    <p className="min-w-0 truncate text-sm text-gray-500">
                        {showAuthor && (
                            <>
                                <span className="font-medium text-gray-800 dark:text-gray-200">
                                    {scope === 'mine' ? 'You' : request.customer.name}
                                </span>
                                {' · '}
                            </>
                        )}
                        {request.city && <>{request.city} · </>}
                        {relativeTime(request.created_at)}
                    </p>
                </div>

                {/* Above the stretched link of the text, or the menu could not be clicked. */}
                <div className="relative z-10 flex shrink-0 items-center gap-2">
                    {showKind && <FeedKindBadge kind="request" />}
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
                    {menu}
                </div>
            </div>

            {/* A request has no title: what the customer wrote is the post. */}
            <p className="line-clamp-4 whitespace-pre-line break-words text-gray-900 dark:text-gray-100">
                <Link href={route('requests.show', request.id)} className="after:absolute after:inset-0">
                    {request.description}
                </Link>
            </p>

            {/* Above the stretched link: a click on a picture opens the viewer, not the request. */}
            {request.media?.length > 0 && (
                <div className="relative z-10">
                    <PostMedia media={request.media} />
                </div>
            )}

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
        </div>
    );
}

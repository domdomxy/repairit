import Avatar from '@/Components/Avatar';
import ClampedText from '@/Components/ClampedText';
import FeedKindBadge from '@/Components/FeedKindBadge';
import PostMedia from '@/Components/PostMedia';
import { formatDateTime, formatMessageTime, relativeTime } from '@/lib/dates';
import { linkify, POST_CARD_LINK_CLASS, POST_LINK_CLASS } from '@/lib/linkify';
import { Link } from '@inertiajs/react';

// A repair request as a card in a list: who is asking, what for, roughly how
// much they would spend and how many quotes it has. The whole card opens the
// request (its text is a link stretched over the card), so the `menu` at the
// top right (RequestMenu: copy link, edit, delete, report) sits above that link.
// `scope` is 'mine' on the customer's own list, where the status
// matters more than the name. In the feed, `showKind` marks it as a request
// among the offers, and `className` can give it another look.
// On the customer's own profile, `showAuthor` is off: the page already says who.
// Pictures and videos attached to the request are stacked as a collage (PostMedia),
// the same as an offer's; a click on one opens them in a viewer to browse.
//
// The header reads like a post: the owner's name with their city beside it, and
// when it was posted underneath. At the bottom left, `footer` holds what a
// technician can do about the request (the button to send a quote), before the
// categories.
// On the request's own page (`detail`), the same card is used: the text is shown in
// full instead of clamped, it is not a link to the page you are already on, and
// `authorHref` makes the asker's name a link to their profile. `actions` is a row
// of buttons under the card's content (what the owner can do with the request).
// The card of a post in the feed, for requests and offers alike: every page that lists
// them (the feed, profiles, search) uses it, so a post looks the same wherever it is.
export const FEED_CARD =
    'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 transition hover:ring-indigo-300 dark:bg-gray-800 dark:ring-white/10 dark:hover:ring-indigo-500';

export default function RequestCard({
    request,
    scope = 'all',
    showKind = false,
    showAuthor = true,
    menu = null,
    footer = null,
    detail = false,
    authorHref = null,
    actions = null,
    className = FEED_CARD,
}) {
    const authorName = scope === 'mine' ? 'You' : request.customer.name;

    return (
        <div className={`relative space-y-3 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {showAuthor && <Avatar user={request.customer} size="sm" />}
                    <div className="min-w-0">
                        {(showAuthor || request.city) && (
                            <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
                                {showAuthor &&
                                    (authorHref ? (
                                        <Link
                                            href={authorHref}
                                            className="truncate font-semibold text-gray-800 hover:underline dark:text-gray-200"
                                        >
                                            {authorName}
                                        </Link>
                                    ) : (
                                        <span className="truncate font-semibold text-gray-800 dark:text-gray-200">
                                            {authorName}
                                        </span>
                                    ))}
                                {request.city && (
                                    <span className="truncate text-gray-500 dark:text-gray-400">
                                        {showAuthor && '· '}
                                        {request.city}
                                    </span>
                                )}
                            </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400" title={formatDateTime(request.created_at)}>
                            {formatMessageTime(request.created_at)} · {relativeTime(request.created_at)}
                        </p>
                    </div>
                </div>

                {/* Above the stretched link of the text, or the menu could not be clicked.
                    Also above the media block below (z-20 > its z-10), since both are
                    positioned siblings and the menu's dropdown must not paint underneath it. */}
                <div className="relative z-20 flex shrink-0 items-center gap-2">
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
            {detail ? (
                <p className="whitespace-pre-line break-words text-gray-900 dark:text-gray-100">
                    {linkify(request.description, { linkClassName: POST_LINK_CLASS })}
                </p>
            ) : (
                <ClampedText className="whitespace-pre-line break-words text-gray-900 dark:text-gray-100">
                    {/* The text around a link opens the request; the link itself opens the URL.
                        They are siblings, never nested, since a link cannot sit inside a link. */}
                    {linkify(request.description, {
                        linkClassName: POST_CARD_LINK_CLASS,
                        renderText: (value) => (
                            <Link href={route('requests.show', request.id)} className="after:absolute after:inset-0">
                                {value}
                            </Link>
                        ),
                    })}
                </ClampedText>
            )}

            {/* Above the stretched link: a click on a picture opens the viewer, not the request. */}
            {request.media?.length > 0 && (
                <div className="relative z-10">
                    <PostMedia media={request.media} />
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Above the stretched link: the button must be clickable. */}
                <div className="relative z-10 flex flex-wrap items-center gap-2">
                    {footer}
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

            {actions && (
                <div className="relative z-10 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
                    {actions}
                </div>
            )}
        </div>
    );
}

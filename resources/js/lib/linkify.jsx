import { splitUrls, toHref } from '@/lib/urls';

// Link style for post text (offers and requests) on a plain page background.
export const POST_LINK_CLASS =
    'break-all text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200';

// The same, for cards whose whole surface is a stretched link to the post: the
// link has to sit above that overlay or it could never be clicked.
export const POST_CARD_LINK_CLASS = `relative z-10 ${POST_LINK_CLASS}`;

// Renders message text with any URLs turned into links that open in a new tab.
//
// renderText lets the caller decorate the plain pieces (and the link labels),
// e.g. to wrap search matches in <mark>. linkClassName styles the anchors.
export function linkify(text, { renderText = (value) => value, linkClassName = 'underline break-all' } = {}) {
    const segments = splitUrls(text);

    // No links: hand back exactly what the caller would have rendered before.
    if (!segments.some((segment) => segment.type === 'link')) return renderText(text);

    return segments.map((segment, index) =>
        segment.type === 'link' ? (
            <a
                key={index}
                href={toHref(segment.value)}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className={linkClassName}
                onClick={(e) => e.stopPropagation()}
            >
                {renderText(segment.value)}
            </a>
        ) : (
            <span key={index}>{renderText(segment.value)}</span>
        ),
    );
}

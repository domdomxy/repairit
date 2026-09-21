import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A post can carry up to six files (see Offer::MEDIA_MAX_FILES). If it ever
// carries more, the first five are shown and the last tile says how many are left.
const MAX_TILES = 6;
const FALLBACK_TILES = 5;

// How the tiles of a post are stacked, by how many there are. `grid` is the
// classes of the container, `tiles` the classes of each tile. The tiles fill
// their cell, so the pictures are cropped to fit and open full size when clicked.
//
//   2 side by side  |  3: one tall + two  |  4: a square  |  5: two + three  |  6: two rows of three
const LAYOUTS = {
    2: { grid: 'grid-cols-2', tiles: ['aspect-[3/2]', 'aspect-[3/2]'] },
    3: { grid: 'grid-cols-2 grid-rows-2 aspect-[2/1]', tiles: ['row-span-2', '', ''] },
    4: { grid: 'grid-cols-2', tiles: ['aspect-[2/1]', 'aspect-[2/1]', 'aspect-[2/1]', 'aspect-[2/1]'] },
    5: {
        grid: 'grid-cols-6',
        tiles: ['col-span-3 aspect-[2/1]', 'col-span-3 aspect-[2/1]', 'col-span-2 aspect-[4/3]', 'col-span-2 aspect-[4/3]', 'col-span-2 aspect-[4/3]'],
    },
    6: { grid: 'grid-cols-3', tiles: Array(6).fill('aspect-[4/3]') },
};

function PlayBadge() {
    return (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
                <svg className="ms-0.5 h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </span>
        </span>
    );
}

// A picture or video on top of the page. Arrow keys, the buttons or a swipe move
// between the files of the post (pictures and videos alike), Escape or a click
// outside closes it.
function Lightbox({ items, index, onClose, onIndex }) {
    const item = items[index];
    const many = items.length > 1;
    const touchStart = useRef(null);

    const move = useCallback(
        (step) => onIndex((index + step + items.length) % items.length),
        [index, items.length, onIndex],
    );

    useEffect(() => {
        function onKey(event) {
            if (event.key === 'Escape') onClose();
            if (many && event.key === 'ArrowLeft') move(-1);
            if (many && event.key === 'ArrowRight') move(1);
        }

        document.addEventListener('keydown', onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previousOverflow;
        };
    }, [move, onClose, many]);

    function onTouchEnd(event) {
        if (touchStart.current === null || !many) return;

        const distance = event.changedTouches[0].clientX - touchStart.current;
        touchStart.current = null;

        if (Math.abs(distance) > 50) move(distance < 0 ? 1 : -1);
    }

    const buttonClass =
        'absolute rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white';
    const stop = (event) => event.stopPropagation();

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={item.name ?? 'Attachment'}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
            onClick={onClose}
            onTouchStart={(event) => {
                touchStart.current = event.touches[0].clientX;
            }}
            onTouchEnd={onTouchEnd}
        >
            {item.type === 'video' ? (
                <video
                    key={item.id}
                    src={item.url}
                    controls
                    autoPlay
                    playsInline
                    aria-label={item.name}
                    className="max-h-full max-w-full rounded-md bg-black"
                    onClick={stop}
                />
            ) : (
                <img
                    key={item.id}
                    src={item.url}
                    alt={item.name ?? 'Attachment'}
                    className="max-h-full max-w-full rounded-md object-contain"
                    onClick={stop}
                />
            )}

            <button type="button" onClick={onClose} aria-label="Close" className={`${buttonClass} right-4 top-4`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {many && (
                <>
                    <button
                        type="button"
                        aria-label="Previous"
                        onClick={(event) => {
                            stop(event);
                            move(-1);
                        }}
                        className={`${buttonClass} left-4 top-1/2 -translate-y-1/2`}
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        aria-label="Next"
                        onClick={(event) => {
                            stop(event);
                            move(1);
                        }}
                        className={`${buttonClass} right-4 top-1/2 -translate-y-1/2`}
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                        {index + 1} / {items.length}
                    </span>
                </>
            )}
        </div>,
        document.body,
    );
}

// One square-ish tile of the stack: a picture, or the first frame of a video with
// a play badge. Clicking it opens the viewer at that file. `more` is how many
// files are not shown, on the last tile.
function Tile({ item, className, more = 0, onOpen }) {
    const isVideo = item.type === 'video';

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={isVideo ? `Play ${item.name ?? 'video'}` : `View ${item.name ?? 'picture'} full size`}
            className={`relative block min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:bg-gray-700 ${className}`}
        >
            {isVideo ? (
                <>
                    <video
                        src={`${item.url}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        tabIndex={-1}
                        className="pointer-events-none absolute inset-0 h-full w-full bg-black object-cover"
                    />
                    <PlayBadge />
                </>
            ) : (
                <img
                    src={item.url}
                    alt={item.name ?? 'Picture'}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                />
            )}

            {more > 0 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-semibold text-white">
                    +{more}
                </span>
            )}
        </button>
    );
}

// The pictures and videos of a post (an offer or a repair request), stacked like
// a photo collage: one file gets the full width, two sit side by side, and up to
// six are tiled so the post stays about as tall as a single picture. Every file
// opens in the same viewer, where all of them can be browsed, videos included.
//
// A single picture is shown whole (never cropped); a single video plays in place.
//
// Inside a card that is one big link (the request card), put this in an element
// with `relative z-10`, or the click opens the card instead of the viewer.
export default function PostMedia({ media }) {
    const [openIndex, setOpenIndex] = useState(null);
    const close = useCallback(() => setOpenIndex(null), []);

    if (!media?.length) return null;

    const viewer =
        openIndex !== null ? <Lightbox items={media} index={openIndex} onClose={close} onIndex={setOpenIndex} /> : null;

    if (media.length === 1) {
        const [item] = media;

        return (
            <>
                <div className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900/40">
                    {item.type === 'video' ? (
                        <video
                            src={item.url}
                            controls
                            playsInline
                            preload="metadata"
                            aria-label={item.name}
                            className="max-h-96 w-full bg-black"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setOpenIndex(0)}
                            aria-label={`View ${item.name ?? 'picture'} full size`}
                            className="block w-full cursor-zoom-in"
                        >
                            <img
                                src={item.url}
                                alt={item.name ?? 'Picture'}
                                loading="lazy"
                                className="max-h-96 w-full object-contain"
                            />
                        </button>
                    )}
                </div>
                {viewer}
            </>
        );
    }

    const tileCount = media.length <= MAX_TILES ? media.length : FALLBACK_TILES;
    const layout = LAYOUTS[tileCount];
    const hidden = media.length - tileCount;

    return (
        <>
            <div
                role="group"
                aria-label={`${media.length} attachments`}
                className={`grid gap-1 overflow-hidden rounded-lg ${layout.grid}`}
            >
                {media.slice(0, tileCount).map((item, index) => (
                    <Tile
                        key={item.id}
                        item={item}
                        className={layout.tiles[index]}
                        more={index === tileCount - 1 ? hidden : 0}
                        onOpen={() => setOpenIndex(index)}
                    />
                ))}
            </div>
            {viewer}
        </>
    );
}

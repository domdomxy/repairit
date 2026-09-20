import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// A full-size picture on top of the page. Arrow keys / buttons move between the
// pictures of the offer, Escape or a click outside closes it.
function Lightbox({ images, index, onClose, onIndex }) {
    const image = images[index];
    const many = images.length > 1;

    const move = useCallback(
        (step) => onIndex((index + step + images.length) % images.length),
        [index, images.length, onIndex],
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

    const buttonClass =
        'absolute rounded-full bg-black/50 p-2 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white';

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-label={image.name ?? 'Offer picture'}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
            onClick={onClose}
        >
            <img
                src={image.url}
                alt={image.name ?? 'Offer picture'}
                className="max-h-full max-w-full rounded-md object-contain"
                onClick={(event) => event.stopPropagation()}
            />

            <button type="button" onClick={onClose} aria-label="Close" className={`${buttonClass} right-4 top-4`}>
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {many && (
                <>
                    <button
                        type="button"
                        aria-label="Previous picture"
                        onClick={(event) => {
                            event.stopPropagation();
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
                        aria-label="Next picture"
                        onClick={(event) => {
                            event.stopPropagation();
                            move(1);
                        }}
                        className={`${buttonClass} right-4 top-1/2 -translate-y-1/2`}
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                    <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                        {index + 1} / {images.length}
                    </span>
                </>
            )}
        </div>,
        document.body,
    );
}

// The pictures and videos of an offer. A single item gets the full width;
// several sit side by side. Pictures open full size in a viewer on top of the
// page, videos play in place (only their first bit is loaded until someone
// presses play).
export default function OfferMediaGrid({ media }) {
    const [openIndex, setOpenIndex] = useState(null);
    const close = useCallback(() => setOpenIndex(null), []);

    if (!media?.length) return null;

    const single = media.length === 1;
    const images = media.filter((item) => item.type !== 'video');

    return (
        <>
            <div className={single ? '' : 'grid grid-cols-2 gap-2'}>
                {media.map((item) =>
                    item.type === 'video' ? (
                        <video
                            key={item.id}
                            src={item.url}
                            controls
                            playsInline
                            preload="metadata"
                            aria-label={item.name}
                            className={`w-full rounded-md bg-black ${single ? 'max-h-80' : 'h-40'}`}
                        />
                    ) : (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setOpenIndex(images.indexOf(item))}
                            aria-label={`View ${item.name ?? 'picture'} full size`}
                            className="block w-full cursor-zoom-in"
                        >
                            <img
                                src={item.url}
                                alt={item.name ?? 'Offer picture'}
                                loading="lazy"
                                className={`w-full rounded-md ${
                                    single ? 'max-h-80 object-contain' : 'h-40 object-cover'
                                }`}
                            />
                        </button>
                    ),
                )}
            </div>

            {openIndex !== null && (
                <Lightbox images={images} index={openIndex} onClose={close} onIndex={setOpenIndex} />
            )}
        </>
    );
}

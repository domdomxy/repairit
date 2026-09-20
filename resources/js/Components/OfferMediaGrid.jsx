// The pictures and videos of an offer. A single item gets the full width;
// several sit side by side. Pictures open full size in a new tab, videos play
// in place (only their first bit is loaded until someone presses play).
export default function OfferMediaGrid({ media }) {
    if (!media?.length) return null;

    const single = media.length === 1;

    return (
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
                    <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer">
                        <img
                            src={item.url}
                            alt={item.name ?? 'Offer picture'}
                            loading="lazy"
                            className={`w-full rounded-md ${
                                single ? 'max-h-80 object-contain' : 'h-40 object-cover'
                            }`}
                        />
                    </a>
                ),
            )}
        </div>
    );
}

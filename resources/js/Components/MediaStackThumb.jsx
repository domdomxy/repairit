import PlayIcon from '@/Components/PlayIcon';

/**
 * How far the fanned-out thumbnails reach past the front one (upward and to
 * the right): 3 or more fan out further than 2. Whoever places the stack
 * leaves this much room above it, and beside it when it sits on the right.
 */
export function stackFan(count) {
    return count >= 3 ? 24 : count === 2 ? 12 : 0;
}

// Up to three thumbnails fanned out behind each other, front one on top, with
// a count badge when there is more than one file.
export default function MediaStackThumb({ attachments, onOpen }) {
    const shown = attachments.slice(0, 3);

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${attachments.length} files`}
            className="relative block h-32 w-32 sm:h-36 sm:w-36"
        >
            {shown
                .map((attachment, i) => ({ attachment, i }))
                .reverse()
                .map(({ attachment, i }) => {
                    const depth = shown.length - 1 - i; // 0 = front-most (on top)
                    const offset = depth * 7;
                    const rotate = depth === 0 ? 0 : (i % 2 === 0 ? -1 : 1) * (depth * 4);

                    return (
                        <span
                            key={attachment.id}
                            style={{
                                transform: `translate(${offset}px, ${-offset}px) rotate(${rotate}deg)`,
                                zIndex: 10 - depth,
                            }}
                            className="absolute inset-0 overflow-hidden rounded-lg border-2 border-white shadow-md dark:border-gray-900"
                        >
                            {attachment.is_video ? (
                                <span className="relative block h-full w-full bg-gray-200 dark:bg-gray-800">
                                    <video src={attachment.url} className="h-full w-full object-cover opacity-90" />
                                    <span className="absolute inset-0 flex items-center justify-center">
                                        <PlayIcon className="h-11 w-11" />
                                    </span>
                                </span>
                            ) : (
                                <img src={attachment.url} alt="" className="h-full w-full object-cover" />
                            )}
                        </span>
                    );
                })}

        </button>
    );
}

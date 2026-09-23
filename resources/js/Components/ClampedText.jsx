import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// A post's text cut to a few lines, with "See more" / "See less" when it is too
// long to fit. Short texts render exactly as before, with no button.
//
// Whether the text overflows is measured while it is collapsed (and again when
// the width changes), so the button only shows up when there is more to read.
// The button sits above a card's stretched link (z-10), or it could never be
// clicked on the request cards.
export default function ClampedText({ className = '', children }) {
    const ref = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);

    function measure() {
        const el = ref.current;

        if (el && !expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1);
    }

    // After every render while collapsed: the text may have changed.
    useLayoutEffect(measure);

    // A resized card rewraps the text, so the answer can change.
    useEffect(() => {
        const el = ref.current;

        if (!el || typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(measure);
        observer.observe(el);

        return () => observer.disconnect();
    }, [expanded]);

    return (
        <div>
            <p ref={ref} className={`${expanded ? '' : 'line-clamp-4'} ${className}`}>
                {children}
            </p>

            {(overflowing || expanded) && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded((value) => !value)}
                    className="relative z-10 mt-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 focus:outline-none focus-visible:underline dark:text-indigo-300 dark:hover:text-indigo-200"
                >
                    {expanded ? 'See less' : 'See more'}
                </button>
            )}
        </div>
    );
}

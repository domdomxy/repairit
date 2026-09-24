import { useLayoutEffect } from 'react';

/**
 * Makes a <textarea> as tall as what is written in it, up to `maxPx`, and back
 * to one line when it is emptied. The scrollbar only appears once the text is
 * taller than `maxPx`. Pass the textarea's ref and its current `value`.
 */
export default function useAutoGrow(ref, value, maxPx = 160) {
    useLayoutEffect(() => {
        const el = ref.current;

        if (!el) return;

        el.style.height = 'auto';

        // scrollHeight leaves out the border, so add it back or the field ends up
        // a couple of pixels short and shows a scrollbar even when empty.
        const wanted = el.scrollHeight + (el.offsetHeight - el.clientHeight);

        el.style.height = `${Math.min(wanted, maxPx)}px`;
        el.style.overflowY = wanted > maxPx ? 'auto' : 'hidden';
    }, [ref, value, maxPx]);
}

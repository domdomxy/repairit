import { useEffect } from 'react';

/**
 * Closes a dropdown (calls `close`) while it is `open`: on a click outside
 * `ref`'s element, or on Escape.
 *
 * "mousedown" rather than "click": a click on a row's own button (a delete
 * button, say) removes that button before a document click handler would run,
 * and it would then look like a click outside.
 */
export default function useDismiss(open, ref, close) {
    useEffect(() => {
        if (!open) return undefined;

        const closeOnOutsideClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) close();
        };
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') close();
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);

        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
        // `close` is a fresh function on every render; only `open` should restart this.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
}

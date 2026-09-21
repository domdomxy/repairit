import { useEffect, useRef, useState } from 'react';

// The feed's filter menu, in the style of a group's "Most relevant" menu: a
// small button showing the current choice, and a list under it where each
// choice has a one-line description and the current one is ticked.
//
// `options` is [{ value, label, description }]; `value` and `onChange` carry
// the option's value. Closes on a click outside, on Escape, and on a choice.
export default function FeedFilterMenu({ options, value, onChange, className = '' }) {
    const [open, setOpen] = useState(false);
    const root = useRef(null);

    const current = options.find((option) => option.value === value) ?? options[0];

    useEffect(() => {
        if (!open) return undefined;

        const onPointerDown = (event) => {
            if (root.current && !root.current.contains(event.target)) setOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div ref={root} className={`relative ${className}`}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((isOpen) => !isOpen)}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
            >
                {current.label}
                <svg
                    className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute start-0 z-30 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-lg bg-white p-1.5 shadow-lg ring-1 ring-black/5 dark:bg-gray-700 dark:ring-white/10"
                >
                    {options.map((option) => {
                        const selected = option.value === current.value;

                        return (
                            <li key={option.value} role="option" aria-selected={selected}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-start hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {option.label}
                                        </span>
                                        <span className="block text-xs text-gray-500 dark:text-gray-300">
                                            {option.description}
                                        </span>
                                    </span>

                                    {selected && (
                                        <svg
                                            className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

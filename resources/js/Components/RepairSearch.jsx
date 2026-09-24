import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// How long after the last key the list is searched.
const SEARCH_DELAY_MS = 300;

// The search box of a repairs list. It searches as you type, a moment after the
// last key, and the server does the search so it covers every repair, not just
// the page on screen. `params` are the other things the list is showing (its
// open tab), kept while searching; `value` is what the server last searched for.
export default function RepairSearch({ routeName, params = {}, value = '', placeholder, label, className = '' }) {
    const [q, setQ] = useState(value);
    const firstRun = useRef(true);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;

            return undefined;
        }

        const term = q.trim();

        if (term === value) return undefined;

        const timer = setTimeout(() => {
            router.get(
                route(routeName),
                term ? { ...params, q: term } : params,
                { preserveState: true, preserveScroll: true, replace: true, only: ['repairs', 'filters'] },
            );
        }, SEARCH_DELAY_MS);

        return () => clearTimeout(timer);
    }, [q]);

    return (
        <div className={`relative ${className}`}>
            <svg
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                aria-label={label}
                className="w-full rounded-xl border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
        </div>
    );
}

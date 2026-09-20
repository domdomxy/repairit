import { router } from '@inertiajs/react';

/**
 * A search bar that is really a doorway to the technician search page.
 *
 * The filters (category, city, availability, radius) live on technicians.index,
 * so typing here would have nowhere to go. Instead the field is read-only and
 * clicking it (or pressing Enter while it is focused) opens that page, which
 * reads like a normal search box but leads straight to the real search.
 */
export default function TechnicianSearchBar({ className = '' }) {
    const open = () => router.visit(route('technicians.index'));

    return (
        <div className={'relative ' + className}>
            {/* Decorative magnifier; the input itself carries the accessible name. */}
            <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
            </svg>

            <input
                type="text"
                readOnly
                onClick={open}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        open();
                    }
                }}
                placeholder="Find a technician"
                aria-label="Find a technician"
                className="w-full cursor-pointer truncate rounded-md border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
            />
        </div>
    );
}

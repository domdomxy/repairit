import { Link } from '@inertiajs/react';

// A row of links that switch between views of one list (the repairs that are
// active or closed, the quotes that are waiting or chosen). The active one
// stands out in white, and each tab can carry a count.
//
// `tabs` are { value, label, href, count? }; `value` is the one that is open.
export default function SegmentedTabs({ label, tabs, value, preserveScroll = false }) {
    return (
        <nav aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900/50">
            {tabs.map((tab) => {
                const active = tab.value === value;

                return (
                    <Link
                        key={tab.value}
                        href={tab.href}
                        preserveScroll={preserveScroll}
                        aria-current={active ? 'page' : undefined}
                        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            active
                                ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-200'
                                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className={`rounded-full px-1.5 text-xs tabular-nums ${
                                    active
                                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
                                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}

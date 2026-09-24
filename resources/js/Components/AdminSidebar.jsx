import { Link } from '@inertiajs/react';

// One outline icon per section, in the same stroke style as the rest of the
// app's icon set (currentColor, 1.8 stroke), so the rail doesn't introduce a
// new visual language of its own.
const ICONS = {
    dashboard: 'M3 12l2-2 7-7 7 7 2 2M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9',
    users: 'M17 21v-2a4 4 0 00-3-3.87M13 7a4 4 0 110 7.75M9 21v-2a4 4 0 013-3.87m-3-3.13a4 4 0 100-8 4 4 0 000 8zM3 21v-2a4 4 0 013-3.87',
    categories:
        'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
    support:
        'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
    reports: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
    'auto-responses': 'M13 10V3L4 14h7v7l9-11h-7z',
    'activity-log': 'M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const LINKS = [
    { label: 'Dashboard', icon: 'dashboard', routeName: 'dashboard', match: 'dashboard' },
    { label: 'Users', icon: 'users', routeName: 'admin.users.index', match: 'admin.users.*' },
    { label: 'Categories', icon: 'categories', routeName: 'admin.categories.index', match: 'admin.categories.*' },
    { label: 'Support', icon: 'support', routeName: 'admin.support.index', match: 'admin.support.*' },
    { label: 'Reports', icon: 'reports', routeName: 'admin.reports.index', match: 'admin.reports.*' },
    { label: 'Auto-responses', icon: 'auto-responses', routeName: 'admin.auto-responses.index', match: 'admin.auto-responses.*' },
    { label: 'Activity log', icon: 'activity-log', routeName: 'admin.logs.index', match: 'admin.logs.*' },
];

function SidebarLink({ link }) {
    const active = route().current(link.match);

    return (
        <Link
            href={route(link.routeName)}
            className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition md:w-full ${
                active
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
            }`}
        >
            <span
                className={`absolute inset-y-1 start-0 hidden w-1 rounded-full bg-indigo-500 md:block ${
                    active ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden="true"
            />
            <svg
                className={`h-5 w-5 shrink-0 ${active ? '' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <path d={ICONS[link.icon]} />
            </svg>
            {link.label}
        </Link>
    );
}

// Admin navigation: a rounded card with icon links. On md+ screens it sticks
// below the top bar so it stays in view while the page beside it scrolls; on
// phones it wraps into a row on top instead.
export default function AdminSidebar() {
    return (
        <aside className="flex flex-wrap gap-1 rounded-2xl bg-white p-3 shadow dark:bg-gray-800 max-md:m-3 md:sticky md:top-20 md:my-3 md:ms-3 md:w-56 md:max-h-[calc(100vh-6rem)] md:shrink-0 md:flex-col md:flex-nowrap md:gap-1.5 md:overflow-y-auto md:p-4">
            <p className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 md:block">
                Admin
            </p>
            {LINKS.map((link) => (
                <SidebarLink key={link.routeName} link={link} />
            ))}
        </aside>
    );
}

import { Link } from '@inertiajs/react';

const LINKS = [
    { label: 'Dashboard', routeName: 'dashboard', match: 'dashboard' },
    { label: 'Users', routeName: 'admin.users.index', match: 'admin.users.*' },
    { label: 'Categories', routeName: 'admin.categories.index', match: 'admin.categories.*' },
    { label: 'Reviews', routeName: 'admin.reviews.index', match: 'admin.reviews.*' },
    { label: 'Support', routeName: 'admin.support.index', match: 'admin.support.*' },
    { label: 'Reports', routeName: 'admin.reports.index', match: 'admin.reports.*' },
    { label: 'Auto-responses', routeName: 'admin.auto-responses.index', match: 'admin.auto-responses.*' },
    { label: 'Activity log', routeName: 'admin.logs.index', match: 'admin.logs.*' },
];

function SidebarLink({ link }) {
    const active = route().current(link.match);

    return (
        <Link
            href={route(link.routeName)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition md:w-full ${
                active
                    ? 'bg-gray-100 text-indigo-600 dark:bg-gray-700 dark:text-indigo-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
        >
            {link.label}
        </Link>
    );
}

// Admin navigation: a rounded card with plain links. On md+ screens the
// parent keeps it fixed while the content beside it scrolls; on phones it
// wraps into a row on top.
export default function AdminSidebar() {
    return (
        <aside className="flex flex-wrap gap-1 rounded-2xl bg-white p-3 shadow dark:bg-gray-800 max-md:m-3 md:my-3 md:ms-3 md:w-56 md:shrink-0 md:flex-col md:flex-nowrap md:self-start md:overflow-y-auto">
            {LINKS.map((link) => (
                <SidebarLink key={link.routeName} link={link} />
            ))}
        </aside>
    );
}

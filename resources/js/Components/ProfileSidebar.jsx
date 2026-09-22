import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { ChevronRightIcon, DashboardIcon, DocumentIcon, LifebuoyIcon, WrenchIcon } from '@/Components/Icons';
import ThemeToggle from '@/Components/ThemeToggle';

// One link of the rail: an icon, a label, and a tint when it is the page you are on.
function NavLink({ href, icon, active, children }) {
    return (
        <Link
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition duration-150 ease-in-out ${
                active
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
        >
            <span
                className={
                    active
                        ? 'text-indigo-600 dark:text-indigo-300'
                        : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200'
                }
            >
                {icon}
            </span>
            {children}
        </Link>
    );
}

// The account rail shown beside the feed: who you are up top, the pages that
// belong to your role under that, then the theme toggle and support pinned
// to the bottom so they're always in the same spot regardless of content height.
export default function ProfileSidebar({ user, className = '' }) {
    // Technicians and customers have a public profile; admins only have their account page.
    const profileHref =
        user.role === 'technician'
            ? route('technicians.show', user.id)
            : user.role === 'customer'
              ? route('customers.show', user.id)
              : route('profile.edit');

    return (
        <section className={`flex flex-col overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800 ${className}`}>
            {/* Who you are: a soft header that opens your profile. */}
            <Link
                href={profileHref}
                className="group block bg-gradient-to-b from-indigo-50 to-white px-4 pb-4 pt-5 transition dark:from-indigo-900/20 dark:to-gray-800"
            >
                <div className="flex items-center gap-3">
                    <div className="rounded-full ring-2 ring-white dark:ring-gray-800">
                        <Avatar user={user} size="md" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                        <p className="text-xs capitalize text-gray-500 dark:text-gray-400">{user.role}</p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                </div>
            </Link>

            <nav aria-label="Your pages" className="space-y-1 px-2 pb-2 pt-2">
                <NavLink href={route('dashboard')} active={route().current('dashboard')} icon={<DashboardIcon />}>
                    {user.role === 'admin' ? 'Administration' : 'Dashboard'}
                </NavLink>

                {/* Requests are browsed in the feed. A technician keeps track of the quotes they sent. */}
                {user.role === 'technician' && (
                    <NavLink
                        href={route('technician.quotes.index')}
                        active={route().current('technician.quotes.*')}
                        icon={<DocumentIcon />}
                    >
                        My quotes
                    </NavLink>
                )}

                {user.role === 'technician' && (
                    <NavLink
                        href={route('technician.repairs.index')}
                        active={route().current('technician.repairs.*')}
                        icon={<WrenchIcon />}
                    >
                        Repairs
                    </NavLink>
                )}
                {user.role === 'customer' && (
                    <NavLink href={route('repairs.index')} active={route().current('repairs.*')} icon={<WrenchIcon />}>
                        My repairs
                    </NavLink>
                )}
            </nav>

            {/* Pushes the toggle and Support down to the bottom of the card. */}
            <div className="flex-1" />

            <div className="space-y-1 border-t border-gray-100 p-2 dark:border-gray-700">
                <ThemeToggle variant="sidebar" />

                <NavLink href={route('support.index')} active={route().current('support.*')} icon={<LifebuoyIcon />}>
                    Support
                </NavLink>
            </div>
        </section>
    );
}

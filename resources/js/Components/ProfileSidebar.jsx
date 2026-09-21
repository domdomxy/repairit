import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import ThemeToggle from '@/Components/ThemeToggle';

const LINK_CLASSES =
    'rounded-md px-2 py-2 text-sm text-gray-700 transition duration-150 ease-in-out hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';

// The account rail shown beside the feed: who you are up top, a way
// back to the dashboard under that, then the theme toggle and support pinned
// to the bottom so they're always in the same spot regardless of content height.
export default function ProfileSidebar({ user, className = '' }) {
    return (
        <section className={`flex flex-col rounded-lg bg-white p-4 shadow dark:bg-gray-800 ${className}`}>
            {/* Technicians and customers have a public profile; admins only have their account page. */}
            <Link
                href={
                    user.role === 'technician'
                        ? route('technicians.show', user.id)
                        : user.role === 'customer'
                          ? route('customers.show', user.id)
                          : route('profile.edit')
                }
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition duration-150 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <Avatar user={user} size="xs" />
                <span className="min-w-0 truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                    {user.name}
                </span>
            </Link>

            <Link href={route('dashboard')} className={`mt-1 ${LINK_CLASSES}`}>
                {user.role === 'admin' ? 'Administration' : 'Dashboard'}
            </Link>

            {/* Requests are browsed in the feed. A technician keeps track of the quotes they sent. */}
            {user.role === 'technician' && (
                <Link href={route('technician.quotes.index')} className={`mt-1 ${LINK_CLASSES}`}>
                    My quotes
                </Link>
            )}

            {user.role === 'technician' && (
                <Link href={route('technician.repairs.index')} className={`mt-1 ${LINK_CLASSES}`}>
                    Repairs
                </Link>
            )}
            {user.role === 'customer' && (
                <Link href={route('repairs.index')} className={`mt-1 ${LINK_CLASSES}`}>
                    My repairs
                </Link>
            )}

            {/* Pushes the toggle and Support down to the bottom of the card. */}
            <div className="flex-1" />

            <ThemeToggle variant="menu" className="rounded-md" />

            <Link href={route('support.index')} className={LINK_CLASSES}>
                Support
            </Link>
        </section>
    );
}

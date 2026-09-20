import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import ThemeToggle from '@/Components/ThemeToggle';

const LINK_CLASSES =
    'rounded-md px-2 py-2 text-sm text-gray-700 transition duration-150 ease-in-out hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700';

// The account rail shown beside the offers list: who you are up top, a way
// back to the dashboard under that, then the theme toggle and support pinned
// to the bottom so they're always in the same spot regardless of content height.
export default function ProfileSidebar({ user, className = '' }) {
    return (
        <section className={`flex flex-col rounded-lg bg-white p-4 shadow dark:bg-gray-800 ${className}`}>
            <Link
                href={route('profile.edit')}
                className="flex items-center gap-3 rounded-md p-2 transition duration-150 ease-in-out hover:bg-gray-100 dark:hover:bg-gray-700"
            >
                <Avatar user={user} size="md" />
                <span className="min-w-0 truncate font-medium text-gray-800 dark:text-gray-200">
                    {user.name}
                </span>
            </Link>

            <Link href={route('dashboard')} className={`mt-1 ${LINK_CLASSES}`}>
                Dashboard
            </Link>

            {/* Pushes the toggle and Support down to the bottom of the card. */}
            <div className="flex-1" />

            <ThemeToggle variant="menu" className="rounded-md" />

            <Link href={route('support.index')} className={LINK_CLASSES}>
                Support
            </Link>
        </section>
    );
}

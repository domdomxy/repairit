import Avatar from '@/Components/Avatar';
import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import MessagesMenu from '@/Components/MessagesMenu';
import NotificationBell from '@/Components/NotificationBell';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import TechnicianSearchBar from '@/Components/TechnicianSearchBar';
import ThemeToggle from '@/Components/ThemeToggle';
import { useInbox } from '@/lib/inbox';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function AuthenticatedLayout({ children }) {
    const { auth, flash, notifications } = usePage().props;
    const user = auth.user;
    const { unread: unreadMessages } = useInbox();

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    return (
        <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900">
            <nav className="border-b border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex shrink-0">
                            <div className="flex shrink-0 items-center">
                                <Link href={route('offers.index')}>
                                    <ApplicationLogo className="block h-9 w-auto fill-current text-gray-800 dark:text-gray-200" />
                                </Link>
                            </div>
                        </div>

                        {/* Find a technician: a search bar on every page, for every role. */}
                        <div className="flex min-w-0 flex-1 items-center justify-center px-3 sm:px-4">
                            <TechnicianSearchBar className="w-full max-w-md" />
                        </div>

                        <div className="hidden sm:ms-6 sm:flex sm:items-center">
                            <MessagesMenu />
                            <NotificationBell />
                            <div className="relative ms-3">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md">
                                            <button
                                                type="button"
                                                className="inline-flex items-center rounded-md border border-transparent bg-white px-3 py-2 text-sm font-medium leading-4 text-gray-500 transition duration-150 ease-in-out hover:text-gray-700 focus:outline-none dark:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-300"
                                            >
                                                <Avatar user={user} size="sm" className="lg:me-2" />
                                                <span className="hidden lg:inline">{user.name}</span>

                                                <svg
                                                    className="-me-0.5 ms-2 h-4 w-4"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <Dropdown.Link
                                            href={route('profile.edit')}
                                        >
                                            Profile
                                        </Dropdown.Link>
                                        <Dropdown.Link
                                            href={route('logout')}
                                            method="post"
                                            as="button"
                                        >
                                            Log Out
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                onClick={() =>
                                    setShowingNavigationDropdown(
                                        (previousState) => !previousState,
                                    )
                                }
                                className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-500 focus:bg-gray-100 focus:text-gray-500 focus:outline-none dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-gray-400 dark:focus:bg-gray-900 dark:focus:text-gray-400"
                            >
                                <svg
                                    className="h-6 w-6"
                                    stroke="currentColor"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        className={
                                            !showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M4 6h16M4 12h16M4 18h16"
                                    />
                                    <path
                                        className={
                                            showingNavigationDropdown
                                                ? 'inline-flex'
                                                : 'hidden'
                                        }
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    className={
                        (showingNavigationDropdown ? 'block' : 'hidden') +
                        ' sm:hidden'
                    }
                >
                    <div className="space-y-1 pb-3 pt-2">
                        {/* The panel doesn't fit a phone's top bar, so here it is a plain link. */}
                        <ResponsiveNavLink
                            href={route('conversations.index')}
                            active={route().current('conversations.*')}
                        >
                            Messages
                            {unreadMessages > 0 && (
                                <span className="ms-2 rounded-full bg-red-600 px-2 text-xs font-semibold text-white">
                                    {unreadMessages}
                                </span>
                            )}
                        </ResponsiveNavLink>
                        <ResponsiveNavLink
                            href={route('notifications.index')}
                            active={route().current('notifications.index')}
                        >
                            Notifications
                            {notifications?.unread > 0 && (
                                <span className="ms-2 rounded-full bg-red-600 px-2 text-xs font-semibold text-white">
                                    {notifications.unread}
                                </span>
                            )}
                        </ResponsiveNavLink>
                    </div>

                    <div className="border-t border-gray-200 pb-1 pt-4 dark:border-gray-600">
                        <div className="flex items-center gap-3 px-4">
                            <Avatar user={user} size="md" />
                            <div className="min-w-0">
                                <div className="text-base font-medium text-gray-800 dark:text-gray-200">
                                    {user.name}
                                </div>
                                <div className="truncate text-sm font-medium text-gray-500">
                                    {user.email}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink
                                href={route('dashboard')}
                                active={route().current('dashboard')}
                            >
                                Dashboard
                            </ResponsiveNavLink>
                            {user.role === 'technician' && (
                                <ResponsiveNavLink
                                    href={route('technician.repairs.index')}
                                    active={route().current('technician.repairs.*')}
                                >
                                    Repairs
                                </ResponsiveNavLink>
                            )}
                            {user.role === 'customer' && (
                                <ResponsiveNavLink
                                    href={route('repairs.index')}
                                    active={route().current('repairs.*')}
                                >
                                    My repairs
                                </ResponsiveNavLink>
                            )}
                            <ResponsiveNavLink href={route('support.index')}>
                                Support
                            </ResponsiveNavLink>
                            <ResponsiveNavLink href={route('profile.edit')}>
                                Profile
                            </ResponsiveNavLink>
                            <ThemeToggle variant="responsive" />
                            <ResponsiveNavLink
                                method="post"
                                href={route('logout')}
                                as="button"
                            >
                                Log Out
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {flash?.success && (
                <div className="w-full px-4 pt-4 sm:px-6 lg:px-8">
                    <div
                        role="status"
                        className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        {flash.success}
                    </div>
                </div>
            )}

            <main className="flex flex-1 flex-col">{children}</main>
        </div>
    );
}

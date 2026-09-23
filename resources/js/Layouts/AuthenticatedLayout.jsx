import Avatar from '@/Components/Avatar';
import logoLight from '@/assets/logos/repairit-icon-only-light.png';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
import Dropdown from '@/Components/Dropdown';
import { PlusIcon } from '@/Components/Icons';
import MessagesMenu from '@/Components/MessagesMenu';
import NotificationBell from '@/Components/NotificationBell';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import SearchBar from '@/Components/SearchBar';
import ThemeToggle from '@/Components/ThemeToggle';
import TrustedHostsSyncListener from '@/Components/TrustedHostsSyncListener';
import { useInbox } from '@/lib/inbox';
import { Link, usePage } from '@inertiajs/react';
import { useState } from 'react';

// The bar is always fixed to the top of the viewport, on every page (it sits
// 5.0625rem from the top for pages that pin side columns under it: bar + gap).
// `stickyNav` is no longer needed for that, but pages still pass it harmlessly.
export default function AuthenticatedLayout({ children, stickyNav = false }) {
    const { auth, flash, notifications } = usePage().props;
    const user = auth.user;
    const { unread: unreadMessages } = useInbox();

    const [showingNavigationDropdown, setShowingNavigationDropdown] =
        useState(false);

    // Admins don't post, so they don't get the composer shortcut. Only
    // technicians can post an offer as well as a request.
    const canCompose = user.role === 'technician' || user.role === 'customer';

    return (
        <div className="flex min-h-screen flex-col bg-gray-100 pt-16 dark:bg-gray-900">
            {/* Fixed, so it never scrolls with the page; the pt-16 above (the
                bar's height) keeps the rest of the content clear of it. */}
            <nav
                className="fixed inset-x-0 top-0 z-40 border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
            >
                <div className="w-full px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 justify-between">
                        <div className="flex shrink-0">
                            <div className="flex shrink-0 items-center">
                                <Link href={route('feed.index')}>
                                    <img src={logoLight} alt="RepairIT" className="block h-9 w-auto dark:hidden" />
                                    <img src={logoDark} alt="RepairIT" className="hidden h-9 w-auto dark:block" />
                                </Link>
                            </div>
                        </div>

                        {/* Search + compose: positioned as a cluster right before the
                            account icons, per the reference layout — search icon that
                            opens a panel with the input, then the compose button, then
                            the divider that separates this cluster from
                            messages/notifications/account. */}
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 px-3 sm:px-4">
                            <SearchBar />

                            {/* Create post: a shortcut to the feed's composer from anywhere in
                                the app. Technicians choose between a request and an offer;
                                customers only post requests. */}
                            {canCompose && (
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            title="Create new post"
                                            aria-label="Create new post"
                                            className="flex h-8 w-10 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 dark:focus:ring-offset-gray-800"
                                        >
                                            <PlusIcon className="h-5 w-5" />
                                        </button>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content align="right" width="48">
                                        <Dropdown.Link
                                            href={route('feed.index', { compose: 'request' })}
                                        >
                                            New request
                                        </Dropdown.Link>
                                        {user.role === 'technician' && (
                                            <Dropdown.Link
                                                href={route('feed.index', { compose: 'offer' })}
                                            >
                                                New offer
                                            </Dropdown.Link>
                                        )}
                                    </Dropdown.Content>
                                </Dropdown>
                            )}

                            {/* Vertical divider, separating the search/compose cluster from
                                messages, notifications, and the account menu. */}
                            <div
                                aria-hidden="true"
                                className="hidden h-8 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:ms-2 sm:block"
                            />
                        </div>

                        <div className="hidden sm:ms-1 sm:flex sm:items-center sm:gap-2">
                            <MessagesMenu />
                            <NotificationBell />
                            <div className="relative">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <button
                                            type="button"
                                            title="Account"
                                            aria-label="Account"
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                                        >
                                            <Avatar user={user} size="sm" />
                                        </button>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <div className="truncate border-b border-gray-100 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200">
                                            {user.name}
                                        </div>
                                        <Dropdown.Link
                                            href={route('profile.edit')}
                                        >
                                            Account
                                        </Dropdown.Link>
                                        <Dropdown.Link href={route('relations.index')}>
                                            Settings
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
                                    href={route('technician.quotes.index')}
                                    active={route().current('technician.quotes.*')}
                                >
                                    My quotes
                                </ResponsiveNavLink>
                            )}
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
                                Account
                            </ResponsiveNavLink>
                            <ResponsiveNavLink href={route('relations.index')}>
                                Settings
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

            <TrustedHostsSyncListener userId={user.id} />

            <main className="flex flex-1 flex-col">{children}</main>
        </div>
    );
}

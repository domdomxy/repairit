import LiveUpdatesBoundary from '@/Components/LiveUpdatesBoundary';
import { relativeTime } from '@/lib/dates';
import useDismiss from '@/lib/useDismiss';
import { Link, router, usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';

const BELL_PATH =
    'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';

// What each kind of notification looks like in the list, and its name in the
// category filter. A kind that isn't listed here falls back to the bell.
const KINDS = {
    review: {
        label: 'Reviews',
        bg: 'bg-amber-100 dark:bg-amber-900',
        text: 'text-amber-600 dark:text-amber-300',
        icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    },
    support: {
        label: 'Support',
        bg: 'bg-emerald-100 dark:bg-emerald-900',
        text: 'text-emerald-600 dark:text-emerald-300',
        icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
    },
    report: {
        label: 'Reports',
        bg: 'bg-rose-100 dark:bg-rose-900',
        text: 'text-rose-600 dark:text-rose-300',
        icon: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
    },
};

const FALLBACK_KIND = {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
    icon: BELL_PATH,
};

// The dropdown opened by the bell: the newest notifications with quick actions.
// Everything older lives on the notifications page ("View all").
function NotificationPanel({ items, unread, onClose, onOpen, onMarkAllRead, onDelete, onClearAll }) {
    const [filter, setFilter] = useState('all');
    const [category, setCategory] = useState('all');

    const visible = items
        .filter((note) => (filter === 'unread' ? !note.read_at : true))
        .filter((note) => (category === 'all' ? true : note.kind === category));

    return (
        <div className="absolute end-0 z-50 mt-2 w-96 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Notifications</p>
                <div className="flex items-center gap-3">
                    {unread > 0 && (
                        <button
                            type="button"
                            onClick={onMarkAllRead}
                            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            Mark all read
                        </button>
                    )}
                    {items.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-transparent dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
                {['all', 'unread'].map((option) => (
                    <button
                        type="button"
                        key={option}
                        onClick={() => setFilter(option)}
                        className={`rounded-md px-2 py-1 text-xs capitalize ${
                            filter === option
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                        }`}
                    >
                        {option}
                    </button>
                ))}
                <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Filter by category"
                    className="ms-auto w-40 rounded-md border-gray-300 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                    <option value="all">All categories</option>
                    {Object.entries(KINDS).map(([kind, { label }]) => (
                        <option key={kind} value={kind}>
                            {label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-b-lg">
                {visible.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <svg
                            className="h-10 w-10 text-gray-300 dark:text-gray-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={BELL_PATH} />
                        </svg>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {items.length === 0 ? 'You have no notifications yet.' : 'No matching notifications.'}
                        </p>
                    </div>
                )}

                {visible.map((note) => {
                    const style = KINDS[note.kind] ?? FALLBACK_KIND;

                    return (
                        <div
                            key={note.id}
                            className={`group flex items-center gap-2 border-b border-gray-50 px-4 py-2 transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30 ${
                                note.read_at ? '' : 'bg-indigo-50/50 dark:bg-indigo-950/30'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={() => onOpen(note)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-start"
                            >
                                <span
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.text}`}
                                >
                                    <svg
                                        className="h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        aria-hidden="true"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d={style.icon} />
                                    </svg>
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span
                                        className={`block break-words text-sm ${
                                            note.read_at
                                                ? 'font-medium text-gray-700 dark:text-gray-300'
                                                : 'font-semibold text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {note.title}
                                    </span>
                                    {note.body && (
                                        <span className="mt-0.5 line-clamp-2 block break-words text-xs text-gray-500 dark:text-gray-400">
                                            {note.body}
                                        </span>
                                    )}
                                    <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">
                                        {relativeTime(note.created_at)}
                                    </span>
                                </span>
                                {!note.read_at && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" aria-label="Unread" />
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(note)}
                                title="Delete notification"
                                aria-label="Delete notification"
                                className="shrink-0 rounded p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-red-500 focus:opacity-100 dark:text-gray-600 dark:hover:bg-gray-700 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                                <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="border-t border-gray-100 px-4 py-2 text-center dark:border-gray-700">
                <Link
                    href={route('notifications.index')}
                    onClick={onClose}
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    View all notifications
                </Link>
            </div>
        </div>
    );
}

// Refreshes the unread count (and the list, when it is on screen) whenever the
// server pushes a notification for this user.
function LiveUpdates({ userId }) {
    useEchoNotification(`App.Models.User.${userId}`, () => {
        router.reload({ only: ['notifications', 'items', 'ticket', 'thread'] });
    });

    return null;
}

// After a change made here, only the notification data needs refreshing: the
// bell's own list, and the notifications page's list when it is the one open.
const REFRESH = { preserveScroll: true, preserveState: true, only: ['notifications', 'items'] };

export default function NotificationBell({ className = '' }) {
    const { auth, notifications } = usePage().props;
    const [open, setOpen] = useState(false);
    // Kept in local state so a click is reflected at once; the server's copy
    // replaces it whenever the page data changes (a new page, or a live update).
    const [items, setItems] = useState(notifications?.recent ?? []);
    const [unread, setUnread] = useState(notifications?.unread ?? 0);
    const containerRef = useRef(null);

    useEffect(() => {
        setItems(notifications?.recent ?? []);
        setUnread(notifications?.unread ?? 0);
    }, [notifications]);

    useDismiss(open, containerRef, () => setOpen(false));

    // Marks it read and goes to what it is about, in one request.
    function openNotification(note) {
        if (!note.read_at) {
            setItems((current) =>
                current.map((n) => (n.id === note.id ? { ...n, read_at: new Date().toISOString() } : n)),
            );
            setUnread((count) => Math.max(0, count - 1));
        }

        setOpen(false);
        router.post(route('notifications.read', note.id));
    }

    function markAllRead() {
        setItems((current) => current.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        setUnread(0);
        router.post(route('notifications.read-all'), {}, REFRESH);
    }

    function deleteNotification(note) {
        setItems((current) => current.filter((n) => n.id !== note.id));
        if (!note.read_at) setUnread((count) => Math.max(0, count - 1));
        router.delete(route('notifications.destroy', note.id), REFRESH);
    }

    function clearAll() {
        if (!window.confirm('Delete all your notifications? This cannot be undone.')) return;

        setItems([]);
        setUnread(0);
        router.delete(route('notifications.clear'), REFRESH);
    }

    return (
        <>
            <div className="relative" ref={containerRef}>
                <button
                    type="button"
                    onClick={() => setOpen((value) => !value)}
                    className={`relative inline-flex items-center rounded-md p-2 transition ${
                        unread > 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    } ${className}`}
                    aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={BELL_PATH} />
                    </svg>
                    {unread > 0 && (
                        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>

                {open && (
                    <NotificationPanel
                        items={items}
                        unread={unread}
                        onClose={() => setOpen(false)}
                        onOpen={openNotification}
                        onMarkAllRead={markAllRead}
                        onDelete={deleteNotification}
                        onClearAll={clearAll}
                    />
                )}
            </div>

            <LiveUpdatesBoundary>
                <LiveUpdates userId={auth.user.id} />
            </LiveUpdatesBoundary>
        </>
    );
}

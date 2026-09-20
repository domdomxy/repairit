import Avatar from '@/Components/Avatar';
import LiveUpdatesBoundary from '@/Components/LiveUpdatesBoundary';
import { relativeTime } from '@/lib/dates';
import { MESSAGES_ICON_PATH, useInbox } from '@/lib/inbox';
import useDismiss from '@/lib/useDismiss';
import { Link, router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import { useRef, useState } from 'react';

// Asks only for the messages data. "async" so it can't interrupt a message
// that is being sent at the same moment.
const REFRESH = { only: ['inbox'], preserveScroll: true, preserveState: true, async: true };

const TABS = [
    { key: 'inbox', label: 'Inbox', empty: 'You have no messages yet.' },
    {
        key: 'requests',
        label: 'Requests',
        empty: 'No new requests. When a customer writes to you, the conversation waits here until you reply.',
    },
];

// The dropdown opened by the chat icon: the newest conversations, split into
// the inbox and the requests like the tabs of the messages page. Everything
// else lives on that page ("View all").
function MessagesPanel({ inbox, requests, activeId, unreadInbox, unreadRequests, onClose }) {
    // Opens on the requests when the inbox has nothing in it but they do.
    const [tab, setTab] = useState(inbox.length === 0 && requests.length > 0 ? 'requests' : 'inbox');

    const conversations = tab === 'requests' ? requests : inbox;
    const unreadOf = (conversation) => (conversation.id === activeId ? 0 : conversation.unread_count);

    return (
        <div className="absolute end-0 z-50 mt-2 w-96 rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Messages</p>
            </div>

            <div role="tablist" className="flex items-center gap-1 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
                {TABS.map(({ key, label }) => {
                    const selected = tab === key;
                    const unread = key === 'requests' ? unreadRequests : unreadInbox;

                    return (
                        <button
                            type="button"
                            role="tab"
                            key={key}
                            aria-selected={selected}
                            onClick={() => setTab(key)}
                            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                                selected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {label}
                            {unread > 0 && (
                                <span
                                    className={`min-w-4 rounded-full px-1 text-[10px] font-semibold ${
                                        selected ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
                                    }`}
                                >
                                    {unread}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="max-h-96 overflow-y-auto">
                {conversations.length === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <svg
                            className="h-10 w-10 text-gray-300 dark:text-gray-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={MESSAGES_ICON_PATH} />
                        </svg>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {TABS.find(({ key }) => key === tab).empty}
                        </p>
                    </div>
                )}

                {conversations.map((conversation) => {
                    const unread = unreadOf(conversation);
                    const last = conversation.last_message;

                    return (
                        <Link
                            key={conversation.id}
                            href={route('conversations.show', conversation.id)}
                            onClick={onClose}
                            className={`flex items-center gap-3 border-b border-gray-50 px-4 py-2.5 transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30 ${
                                unread > 0 ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : ''
                            }`}
                        >
                            <Avatar user={{ name: conversation.name, avatar_url: conversation.avatar_url }} size="md" />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <span
                                            className={`truncate text-sm ${
                                                unread > 0
                                                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                                                    : 'font-medium text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            {conversation.name}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                                        {relativeTime(last.created_at)}
                                    </span>
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    <span
                                        className={`truncate text-xs ${
                                            unread > 0
                                                ? 'font-medium text-gray-800 dark:text-gray-200'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        {last.preview ? `${last.from_me ? 'You: ' : ''}${last.preview}` : ''}
                                    </span>
                                    {unread > 0 && (
                                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
                                            {unread}
                                        </span>
                                    )}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>

            <div className="border-t border-gray-100 px-4 py-2 text-center dark:border-gray-700">
                <Link
                    href={route('conversations.index')}
                    onClick={onClose}
                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    View all messages
                </Link>
            </div>
        </div>
    );
}

// Refreshes the panel whenever the server says this user's messages changed.
// The messages page's own list is refreshed too (it is not there on other pages,
// which is fine).
function LiveUpdates({ userId }) {
    useEcho(`App.Models.User.${userId}`, '.inbox.updated', () => {
        router.reload({ ...REFRESH, only: ['inbox', 'conversations'] });
    });

    return null;
}

export default function MessagesMenu({ className = '' }) {
    const { auth } = usePage().props;
    const { recent, requests, activeId, unread, unreadInbox, unreadRequests } = useInbox();
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useDismiss(open, containerRef, () => setOpen(false));

    function toggle() {
        // Fresh data whenever it is opened, in case live updates are not running.
        if (!open) router.reload(REFRESH);

        setOpen((value) => !value);
    }

    const onMessagesPage = route().current('conversations.*');

    return (
        <>
            <div className="relative" ref={containerRef}>
                <button
                    type="button"
                    onClick={toggle}
                    className={`relative inline-flex items-center rounded-md p-2 transition ${
                        unread > 0 || onMessagesPage
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                    } ${className}`}
                    aria-label={unread > 0 ? `Messages, ${unread} unread` : 'Messages'}
                    aria-haspopup="true"
                    aria-expanded={open}
                >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d={MESSAGES_ICON_PATH} />
                    </svg>
                    {unread > 0 && (
                        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                            {unread > 99 ? '99+' : unread}
                        </span>
                    )}
                </button>

                {open && (
                    <MessagesPanel
                        inbox={recent}
                        requests={requests}
                        activeId={activeId}
                        unreadInbox={unreadInbox}
                        unreadRequests={unreadRequests}
                        onClose={() => setOpen(false)}
                    />
                )}
            </div>

            <LiveUpdatesBoundary>
                <LiveUpdates userId={auth.user.id} />
            </LiveUpdatesBoundary>
        </>
    );
}

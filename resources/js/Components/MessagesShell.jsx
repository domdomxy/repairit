import Avatar from '@/Components/Avatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { Head, Link, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

const TABS = [
    { key: 'inbox', label: 'Inbox', empty: 'No conversations yet.' },
    {
        key: 'requests',
        label: 'Requests',
        empty: 'No new requests. When a customer writes to you, the conversation waits here until you reply.',
    },
    {
        key: 'hidden',
        label: 'Hidden',
        empty: 'Nothing hidden. Conversations you hide are kept here until you unhide them.',
    },
];

// Section 1: the conversations, split into the inbox, the requests (new
// conversations from customers that haven't been answered yet) and the ones
// this person has hidden.
function ConversationList({ conversations, activeId, className }) {
    const { auth } = usePage().props;
    const active = conversations.find((conversation) => conversation.id === activeId);

    // Opens on the tab the open conversation belongs to, the inbox otherwise.
    const home = active?.is_hidden ? 'hidden' : active?.is_request ? 'requests' : 'inbox';
    const [tab, setTab] = useState(home);

    // Follows the open conversation: choosing another one, or replying to a
    // request (which moves it to the inbox).
    useEffect(() => setTab(home), [activeId, home]);

    const inTab = (key) =>
        conversations.filter((conversation) =>
            key === 'hidden' ? conversation.is_hidden : !conversation.is_hidden && conversation.is_request === (key === 'requests'),
        );
    // The open conversation is being read, so it adds nothing to the counts.
    const unreadIn = (key) =>
        inTab(key)
            .filter((conversation) => conversation.id !== activeId)
            .reduce((sum, conversation) => sum + conversation.unread_count, 0);

    const visible = inTab(tab);

    return (
        <section className={`min-h-0 flex-col border-gray-200 dark:border-gray-700 lg:border-e ${className}`}>
            <div role="tablist" className="flex gap-1.5 border-b border-gray-200 p-3 dark:border-gray-700">
                {TABS.map(({ key, label }) => {
                    const selected = tab === key;
                    const unread = unreadIn(key);

                    return (
                        <button
                            type="button"
                            role="tab"
                            key={key}
                            aria-selected={selected}
                            onClick={() => setTab(key)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium transition ${
                                selected
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                            }`}
                        >
                            {label}
                            {unread > 0 && (
                                <span
                                    className={`min-w-5 rounded-full px-1.5 text-xs font-semibold ${
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

            <div className="min-h-0 flex-1 overflow-y-auto">
                {visible.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {TABS.find(({ key }) => key === tab).empty}
                    </p>
                )}

                {visible.map((conversation) => {
                    const otherParty =
                        auth.user.id === conversation.customer_id ? conversation.technician : conversation.customer;
                    const isActive = conversation.id === activeId;
                    const unread = isActive ? 0 : conversation.unread_count;
                    const last = conversation.last_message;

                    return (
                        // Keeps this list (and its scroll position) while the conversation beside it changes.
                        <Link
                            key={conversation.id}
                            href={route('conversations.show', conversation.id)}
                            preserveState
                            preserveScroll
                            aria-current={isActive ? 'true' : undefined}
                            className={`flex items-center gap-3 border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30 ${
                                isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                            }`}
                        >
                            <Avatar user={otherParty} size="md" />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                    <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                                        {otherParty.name}
                                    </span>
                                    {last && (
                                        <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                                            {relativeTime(last.created_at)}
                                        </span>
                                    )}
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    <span
                                        className={`truncate text-xs ${
                                            unread > 0
                                                ? 'font-medium text-gray-800 dark:text-gray-200'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        {last?.preview ? `${last.from_me ? 'You: ' : ''}${last.preview}` : 'No messages yet'}
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
        </section>
    );
}

// The messages page: the list of conversations on the left; when one is open,
// the conversation in the middle (`children`) and who it is with on the right
// (`info`, only while `infoOpen`); when none is open, one empty area in place
// of those two.
export default function MessagesShell({ conversations, activeId = null, info = null, infoOpen = false, children }) {
    return (
        <AuthenticatedLayout>
            <Head title="Messages" />

            {/* Fills everything below the top bar: no page heading, no margins. */}
            <div className={`relative grid h-[calc(100vh-4rem)] min-h-[28rem] overflow-hidden bg-white dark:bg-gray-800 lg:grid-cols-[20rem_minmax(0,1fr)] ${
                    activeId && infoOpen ? 'xl:grid-cols-[20rem_minmax(0,1fr)_18rem]' : ''
                }`}>
                {/* On a narrow screen only one of the list and the conversation shows. */}
                <ConversationList
                    conversations={conversations}
                    activeId={activeId}
                    className={activeId ? 'hidden lg:flex' : 'flex'}
                />

                {activeId ? (
                    <>
                        <section className="flex min-h-0 min-w-0 flex-col">{children}</section>
                        {info}
                    </>
                ) : (
                    <section className="hidden flex-col items-center justify-center gap-3 px-6 text-center lg:flex">
                        <svg
                            className="h-14 w-14 text-gray-300 dark:text-gray-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                        </svg>
                        <p className="font-medium text-gray-700 dark:text-gray-300">Select a conversation</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Choose one from the list to read it and reply.
                        </p>
                    </section>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

import Avatar from '@/Components/Avatar';
import ConversationTypingWatcher from '@/Components/ConversationTypingWatcher';
import { PushpinIcon } from '@/Components/Icons';
import MessageStatus from '@/Components/MessageStatus';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const TABS = [
    { key: 'inbox', label: 'Inbox', empty: 'No conversations yet.' },
    {
        key: 'requests',
        label: 'Requests',
        empty: 'No new requests. When a customer writes to you, or someone you restricted does, the conversation waits here.',
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
    const [query, setQuery] = useState('');

    // Follows the open conversation: choosing another one, or replying to a
    // request (which moves it to the inbox).
    useEffect(() => setTab(home), [activeId, home]);

    const otherPartyOf = (conversation) =>
        auth.user.id === conversation.customer_id ? conversation.technician : conversation.customer;

    function togglePin(conversation, e) {
        e.preventDefault();
        e.stopPropagation();

        const url = route(conversation.is_pinned ? 'conversations.unpin' : 'conversations.pin', conversation.id);
        router.post(url, {}, { preserveScroll: true, preserveState: true });
    }

    const inTab = (key) =>
        conversations.filter((conversation) =>
            key === 'hidden' ? conversation.is_hidden : !conversation.is_hidden && conversation.is_request === (key === 'requests'),
        );
    // The open conversation is being read, so it adds nothing to the counts.
    const unreadIn = (key) =>
        inTab(key)
            .filter((conversation) => conversation.id !== activeId && !conversation.is_muted && !conversation.is_restricted)
            .reduce((sum, conversation) => sum + conversation.unread_count, 0);

    const term = query.trim().toLowerCase();
    const visible = inTab(tab).filter(
        (conversation) => term === '' || otherPartyOf(conversation).name.toLowerCase().includes(term),
    );

    // Which rows currently show "Typing…" in place of the last message, each
    // clearing itself a few seconds after its last whisper.
    const [typingIds, setTypingIds] = useState({});
    const typingTimeouts = useRef({});

    const markTyping = useCallback((id) => {
        setTypingIds((current) => (current[id] ? current : { ...current, [id]: true }));
        clearTimeout(typingTimeouts.current[id]);
        typingTimeouts.current[id] = setTimeout(() => {
            setTypingIds((current) => {
                if (!current[id]) return current;
                const { [id]: _, ...rest } = current;
                return rest;
            });
        }, 3000);
    }, []);

    useEffect(() => () => Object.values(typingTimeouts.current).forEach(clearTimeout), []);

    return (
        <section
            className={`min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800 ${className}`}
        >
            <div className="border-b border-gray-200 p-3 dark:border-gray-700">
                <div className="relative">
                    <svg
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="2"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search conversations"
                        aria-label="Search conversations"
                        className="w-full rounded-md border-gray-300 bg-gray-50 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:focus:border-indigo-500 dark:focus:ring-indigo-500"
                    />
                </div>
            </div>

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
                        {term === '' ? TABS.find(({ key }) => key === tab).empty : `No conversations match "${query.trim()}".`}
                    </p>
                )}

                {visible.map((conversation) => {
                    const otherParty = otherPartyOf(conversation);
                    const isActive = conversation.id === activeId;
                    const unread = isActive ? 0 : conversation.unread_count;
                    const last = conversation.last_message;
                    // Muted and restricted people are read without the badge: a grey number instead of a blue one.
                    const quiet = conversation.is_muted || conversation.is_restricted;
                    const status = [
                        conversation.is_blocked && 'Blocked',
                        conversation.is_restricted && 'Restricted',
                        conversation.is_muted && 'Muted',
                    ]
                        .filter(Boolean)
                        .join(' · ');

                    return (
                        // Keeps this list (and its scroll position) while the conversation beside it changes.
                        <Link
                            key={conversation.id}
                            href={route('conversations.show', conversation.id)}
                            preserveState
                            preserveScroll
                            aria-current={isActive ? 'true' : undefined}
                            className={`group/row flex items-center gap-3 border-b border-gray-100 px-4 py-3 transition hover:bg-gray-50 dark:border-gray-700/50 dark:hover:bg-gray-700/30 ${
                                isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                            }`}
                        >
                            {!isActive && (
                                <ConversationTypingWatcher conversationId={conversation.id} onTyping={markTyping} />
                            )}
                            <Avatar user={otherParty} size="md" />
                            <span className="min-w-0 flex-1">
                                <span className="flex items-baseline justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-1">
                                        <span className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>
                                            {otherParty.name}
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={(e) => togglePin(conversation, e)}
                                            aria-label={conversation.is_pinned ? 'Unpin conversation' : 'Pin conversation'}
                                            title={conversation.is_pinned ? 'Unpin conversation' : 'Pin conversation'}
                                            className={`rounded p-0.5 transition ${
                                                conversation.is_pinned
                                                    ? 'text-indigo-500'
                                                    : 'text-gray-300 opacity-0 hover:text-gray-500 group-hover/row:opacity-100 dark:text-gray-500 dark:hover:text-gray-300'
                                            }`}
                                        >
                                            <PushpinIcon className="h-3.5 w-3.5" />
                                        </button>
                                        {last && (
                                            <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                                {relativeTime(last.created_at)}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    {typingIds[conversation.id] ? (
                                        <span className="truncate text-xs italic text-indigo-500 dark:text-indigo-400">
                                            Typing…
                                        </span>
                                    ) : (
                                        <span
                                            className={`truncate text-xs ${
                                                unread > 0
                                                    ? 'font-medium text-gray-800 dark:text-gray-200'
                                                    : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                        >
                                            {status && <span className="me-1 font-medium">{status} ·</span>}
                                            {last?.preview ? `${last.from_me ? 'You: ' : ''}${last.preview}` : 'No messages yet'}
                                        </span>
                                    )}
                                    {unread > 0 ? (
                                        <span
                                            className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white ${
                                                quiet ? 'bg-gray-400 dark:bg-gray-500' : 'bg-indigo-600'
                                            }`}
                                        >
                                            {unread}
                                        </span>
                                    ) : (
                                        last?.from_me && <MessageStatus seen={!!last.read_at} compact />
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
            <div className={`relative grid h-[calc(100vh-4rem)] min-h-[28rem] gap-4 bg-gray-100 p-4 dark:bg-gray-900 lg:grid-cols-[20rem_minmax(0,1fr)] ${
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
                        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
                            {children}
                        </section>
                        {info}
                    </>
                ) : (
                    <section className="hidden flex-col items-center justify-center gap-3 rounded-xl bg-white px-6 text-center shadow-sm dark:bg-gray-800 lg:flex">
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
                                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 015.25 3.75h13.5A2.25 2.25 0 0121 6v3.776"
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

import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import Pagination from '@/Components/Pagination';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import { BUTTON, CARD, SupportHeader } from '@/Components/SupportUI';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatDateTime } from '@/lib/dates';

// Subject and ID | topic | last activity | status. On a phone the columns stack.
const ROW = 'grid gap-x-6 gap-y-1 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_12rem_7rem] md:items-center';

// How long after the last key the list is searched.
const SEARCH_DELAY_MS = 300;

export default function Index({ tickets, filters }) {
    const [q, setQ] = useState(filters.q ?? '');
    const searched = (filters.q ?? '') !== '';
    // Nothing to search until there is at least one ticket (or a search is under way).
    const hasTickets = tickets.data.length > 0 || searched;
    const firstRun = useRef(true);

    // Searches as you type, a moment after the last key. The search is done by the
    // server so it covers every ticket, not just the page on screen.
    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;

            return undefined;
        }

        const term = q.trim();

        if (term === (filters.q ?? '')) return undefined;

        const timer = setTimeout(() => {
            router.get(
                route('support.index'),
                term ? { q: term } : {},
                { preserveState: true, preserveScroll: true, replace: true, only: ['tickets', 'filters'] },
            );
        }, SEARCH_DELAY_MS);

        return () => clearTimeout(timer);
    }, [q]);

    return (
        <SidebarLayout>
            <Head title="Support" />

            <div className="mx-auto max-w-[96rem]">
                <SupportHeader
                    title="Support"
                    action={
                        <Link href={route('support.create')} className={BUTTON}>
                            New ticket
                        </Link>
                    }
                >
                    Your tickets and our replies, in one place.
                </SupportHeader>

                {hasTickets && (
                    <div className="relative mb-4">
                        <svg
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search by subject, ticket ID or topic"
                            aria-label="Search tickets"
                            className="w-full rounded-xl border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                        />
                    </div>
                )}

                {tickets.data.length === 0 && searched ? (
                    <div className={`${CARD} px-6 py-14 text-center`}>
                        <p className="font-semibold">No tickets match your search</p>
                        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                            Try a different word, or the ticket ID (it looks like SUP-ABC123).
                        </p>
                    </div>
                ) : tickets.data.length === 0 ? (
                    <div className={`${CARD} px-6 py-14 text-center`}>
                        <p className="font-semibold">No tickets yet</p>
                        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                            If something is wrong or you have a question, open a ticket and the team will reply here.
                        </p>
                        <Link href={route('support.create')} className={`${BUTTON} mt-5`}>
                            Open a ticket
                        </Link>
                    </div>
                ) : (
                    <div className={`${CARD} overflow-hidden`}>
                        <div className={`${ROW} hidden border-b border-gray-100 py-3 text-xs font-medium text-gray-500 md:grid dark:border-white/10 dark:text-gray-400`}>
                            <span>Ticket</span>
                            <span>Topic</span>
                            <span>Last activity</span>
                            <span>Status</span>
                        </div>

                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                            {tickets.data.map((ticket) => (
                                <li key={ticket.id}>
                                    <Link
                                        href={route('support.show', ticket.id)}
                                        className={`${ROW} transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-gray-700/40`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{ticket.subject}</p>
                                            <p className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                                                {ticket.tracking_id}
                                            </p>
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{ticket.category_label}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatDateTime(ticket.last_activity_at)}
                                        </p>
                                        <div>
                                            <SupportStatusBadge status={ticket.status} />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-4">
                    <Pagination links={tickets.links} />
                </div>
            </div>
        </SidebarLayout>
    );
}

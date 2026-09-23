import { Head, Link } from '@inertiajs/react';
import Pagination from '@/Components/Pagination';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import { BUTTON, CARD, SupportHeader } from '@/Components/SupportUI';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/lib/dates';

// Subject and ID | topic | last activity | status. On a phone the columns stack.
const ROW = 'grid gap-x-6 gap-y-1 px-5 py-4 md:grid-cols-[minmax(0,1fr)_10rem_12rem_7rem] md:items-center';

export default function Index({ tickets }) {
    return (
        <AuthenticatedLayout>
            <Head title="Support" />

            <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
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

                {tickets.data.length === 0 ? (
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
        </AuthenticatedLayout>
    );
}

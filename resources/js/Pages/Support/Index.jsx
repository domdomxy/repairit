import { Head, Link } from '@inertiajs/react';
import Pagination from '@/Components/Pagination';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/lib/dates';

export default function Index({ tickets }) {
    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-semibold">Support</h2>
                    <Link
                        href={route('support.create')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        New ticket
                    </Link>
                </div>
            }
        >
            <Head title="Support" />

            <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
                {tickets.data.length === 0 ? (
                    <div className="rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
                        <p className="text-sm text-gray-500">
                            You have not contacted support yet. If something is wrong or you have a question, open a
                            ticket and the team will reply here.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {tickets.data.map((ticket) => (
                            <li key={ticket.id}>
                                <Link
                                    href={route('support.show', ticket.id)}
                                    className="block rounded-lg bg-white p-4 shadow transition hover:opacity-90 dark:bg-gray-800"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">{ticket.subject}</div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {ticket.tracking_id} · {ticket.category_label} · Last activity{' '}
                                                {formatDateTime(ticket.last_activity_at)}
                                            </div>
                                        </div>
                                        <SupportStatusBadge status={ticket.status} />
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}

                <Pagination links={tickets.links} />
            </div>
        </AuthenticatedLayout>
    );
}

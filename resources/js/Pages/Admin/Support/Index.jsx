import { Head, Link, router } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { useState } from 'react';
import Pagination from '@/Components/Pagination';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/lib/dates';
import { statusLabels } from '@/lib/support';

export default function Index({ tickets, filters, categories, counts }) {
    const [q, setQ] = useState(filters.q ?? '');
    const status = filters.status ?? '';
    const category = filters.category ?? '';

    function apply(next = {}) {
        const values = { q, status, category, ...next };
        // Empty values are dropped so the URL stays clean.
        const query = Object.fromEntries(Object.entries(values).filter(([, value]) => value));

        router.get(route('admin.support.index'), query, { preserveState: true, replace: true });
    }

    const tab = (active) =>
        `rounded-full px-3 py-1 text-sm transition ${
            active
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 shadow hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300'
        }`;

    return (
        <AuthenticatedLayout>
            <Head title="Support tickets" />

            <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => apply({ status: '' })} className={tab(status === '')}>
                        All
                    </button>
                    {Object.entries(statusLabels).map(([value, label]) => (
                        <button key={value} onClick={() => apply({ status: value })} className={tab(status === value)}>
                            {label} ({counts[value] ?? 0})
                        </button>
                    ))}
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply();
                    }}
                    className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                >
                    <div className="min-w-[14rem] flex-1">
                        <label htmlFor="q" className="block text-xs font-medium text-gray-500">
                            Search ticket ID, subject, name or email
                        </label>
                        <input
                            id="q"
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-xs font-medium text-gray-500">
                            Topic
                        </label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => apply({ category: e.target.value })}
                            className="mt-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        >
                            <option value="">All topics</option>
                            {Object.entries(categories).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        Search
                    </button>
                </form>

                <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3">Ticket</th>
                                <th className="px-4 py-3">From</th>
                                <th className="px-4 py-3">Topic</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Last activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {tickets.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No tickets match these filters.
                                    </td>
                                </tr>
                            )}

                            {tickets.data.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                                    <td className="px-4 py-3">
                                        <Link
                                            href={route('admin.support.show', ticket.id)}
                                            className="font-medium text-indigo-600 hover:underline"
                                        >
                                            {ticket.subject}
                                        </Link>
                                        <div className="text-xs text-gray-500">{ticket.tracking_id}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar user={ticket.user} size="sm" />
                                            <div>
                                                <div>{ticket.user.name}</div>
                                                <div className="text-xs text-gray-500">{ticket.user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">{ticket.category_label}</td>
                                    <td className="px-4 py-3">
                                        <SupportStatusBadge status={ticket.status} />
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                                        {formatDateTime(ticket.last_activity_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={tickets.links} />
            </div>
        </AuthenticatedLayout>
    );
}

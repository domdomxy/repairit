import { Head, Link, router, useForm } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import SupportThread from '@/Components/SupportThread';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatDateTime } from '@/lib/dates';
import { statusLabels } from '@/lib/support';

export default function Show({ ticket, thread }) {
    // '' means "leave the status to the server" (an untouched ticket becomes in progress).
    const { data, setData, post, processing, errors, reset } = useForm({ body: '', status: '' });
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        post(route('admin.support.reply', ticket.id), {
            preserveScroll: true,
            onSuccess: () => reset('body', 'status'),
        });
    }

    function setStatus(status) {
        router.post(route('admin.support.status', ticket.id), { status }, { preserveScroll: true });
    }

    return (
        <AdminLayout>
            <Head title={`Ticket ${ticket.tracking_id}`} />

            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Link href={route('admin.support.index')} className="text-sm text-indigo-600 hover:underline">
                        All tickets
                    </Link>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="truncate text-xl font-semibold">{ticket.subject}</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                {ticket.tracking_id} · {ticket.category_label} · Opened {formatDateTime(ticket.created_at)}
                            </p>
                        </div>
                        <SupportStatusBadge status={ticket.status} />
                    </div>

                    <SupportThread thread={thread} viewerIsStaff />

                    {closed ? (
                        <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                            This ticket is closed. Reopen it to reply.
                        </p>
                    ) : (
                        <form onSubmit={submit} className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <label htmlFor="reply" className="block text-sm font-medium">
                                Reply to {ticket.user.name}
                            </label>
                            <textarea
                                id="reply"
                                rows={5}
                                maxLength={5000}
                                value={data.body}
                                onChange={(e) => setData('body', e.target.value)}
                                className="block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                            />
                            <InputError message={errors.body} />
                            <InputError message={errors.status} />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <label htmlFor="status">Then set status to</label>
                                    <select
                                        id="status"
                                        value={data.status}
                                        onChange={(e) => setData('status', e.target.value)}
                                        className="rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                                    >
                                        <option value="">Automatic</option>
                                        {Object.entries(statusLabels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || !data.body.trim()}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                                >
                                    Send reply
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <aside className="space-y-4">
                    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <h3 className="text-xs font-semibold uppercase text-gray-500">Requester</h3>
                        <div className="mt-2 flex items-center gap-3">
                            <Avatar user={ticket.user} size="md" />
                            <div className="min-w-0">
                                <p className="font-medium">{ticket.user.name}</p>
                                <p className="truncate text-sm text-gray-500">{ticket.user.email}</p>
                            </div>
                        </div>
                        <p className="mt-1 text-xs capitalize text-gray-500">
                            {ticket.user.is_guest ? (
                                'Guest — no account'
                            ) : (
                                <>
                                    {ticket.user.role}
                                    {ticket.user.suspended && <span className="ms-2 text-red-600">Suspended</span>}
                                </>
                            )}
                        </p>
                    </section>

                    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <h3 className="text-xs font-semibold uppercase text-gray-500">Status</h3>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {Object.entries(statusLabels)
                                .filter(([value]) => value !== ticket.status)
                                .map(([value, label]) => (
                                    <button
                                        key={value}
                                        onClick={() => setStatus(value)}
                                        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                                    >
                                        {value === 'open' && closed ? 'Reopen' : `Mark ${label.toLowerCase()}`}
                                    </button>
                                ))}
                        </div>
                    </section>
                </aside>
            </div>
        </AdminLayout>
    );
}

import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatDateTime } from '@/lib/dates';

function Stat({ label, value, href, alert = false }) {
    const body = (
        <div className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-semibold ${alert && value > 0 ? 'text-red-600' : ''}`}>{value}</p>
        </div>
    );

    return href ? (
        <Link href={href} className="block transition hover:opacity-80">
            {body}
        </Link>
    ) : (
        body
    );
}

const adminLinks = [
    { label: 'Users', routeName: 'admin.users.index' },
    { label: 'Categories', routeName: 'admin.categories.index' },
    { label: 'Reviews', routeName: 'admin.reviews.index' },
    { label: 'Activity log', routeName: 'admin.logs.index' },
];

export default function Admin({ stats, recentUsers, recentLogs }) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Admin Dashboard</h2>}>
            <Head title="Admin Dashboard" />

            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <div className="flex flex-wrap gap-3">
                    {adminLinks.map((link) => (
                        <Link
                            key={link.routeName}
                            href={route(link.routeName)}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Stat label="Total users" value={stats.users} href={route('admin.users.index')} />
                    <Stat
                        label="Customers"
                        value={stats.customers}
                        href={route('admin.users.index', { role: 'customer' })}
                    />
                    <Stat
                        label="Technicians"
                        value={stats.technicians}
                        href={route('admin.users.index', { role: 'technician' })}
                    />
                    <Stat
                        label="Suspended"
                        value={stats.suspended}
                        alert
                        href={route('admin.users.index', { status: 'suspended' })}
                    />
                    <Stat label="Categories" value={stats.categories} href={route('admin.categories.index')} />
                    <Stat label="Conversations" value={stats.conversations} />
                    <Stat label="Reviews" value={stats.reviews} href={route('admin.reviews.index')} />
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <section className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Recent sign-ups</h3>
                            <Link href={route('admin.users.index')} className="text-sm text-indigo-600 hover:underline">
                                All users
                            </Link>
                        </div>
                        <ul className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                            {recentUsers.map((user) => (
                                <li key={user.id} className="flex items-center justify-between py-2">
                                    <div>
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-xs capitalize text-gray-500">{user.role}</div>
                                    </div>
                                    <span className="text-xs text-gray-500">{formatDate(user.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="rounded-lg bg-white p-5 shadow dark:bg-gray-800">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Recent admin activity</h3>
                            <Link href={route('admin.logs.index')} className="text-sm text-indigo-600 hover:underline">
                                Full log
                            </Link>
                        </div>
                        {recentLogs.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500">Nothing has been logged yet.</p>
                        ) : (
                            <ul className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                                {recentLogs.map((log) => (
                                    <li key={log.id} className="py-2">
                                        <div>{log.description}</div>
                                        <div className="text-xs text-gray-500">
                                            {log.admin ?? 'Deleted admin'} · {formatDateTime(log.created_at)}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

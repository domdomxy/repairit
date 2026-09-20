import { Head, Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { BarChart, CHART_COLORS, ChartCard, DonutChart, HBarChart, LineChart } from '@/Components/Charts';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/dates';

const adminLinks = [
    { label: 'Users', routeName: 'admin.users.index' },
    { label: 'Categories', routeName: 'admin.categories.index' },
    { label: 'Reviews', routeName: 'admin.reviews.index' },
    { label: 'Support', routeName: 'admin.support.index' },
    { label: 'Reports', routeName: 'admin.reports.index' },
    { label: 'Activity log', routeName: 'admin.logs.index' },
];

// Stored value => label and colour, so a chart keeps the same order and colours.
const ROLE_SLICES = [
    { key: 'customer', label: 'Customers', color: CHART_COLORS.indigo },
    { key: 'technician', label: 'Technicians', color: CHART_COLORS.emerald },
    { key: 'admin', label: 'Admins', color: CHART_COLORS.purple },
];

const AVAILABILITY_SLICES = [
    { key: 'available', label: 'Available', color: CHART_COLORS.emerald },
    { key: 'busy', label: 'Busy', color: CHART_COLORS.amber },
    { key: 'offline', label: 'Offline', color: CHART_COLORS.gray },
];

const TICKET_SLICES = [
    { key: 'open', label: 'Open', color: CHART_COLORS.rose },
    { key: 'in_progress', label: 'In progress', color: CHART_COLORS.amber },
    { key: 'resolved', label: 'Resolved', color: CHART_COLORS.emerald },
    { key: 'closed', label: 'Closed', color: CHART_COLORS.gray },
];

function slices(config, counts) {
    return config.map(({ key, label, color }) => ({ label, color, value: counts[key] ?? 0 }));
}

export default function Admin({ stats, trends, charts, recentUsers, recentLogs }) {
    const dayLabels = charts.signups.map((day) => formatShortDate(day.date));
    const ratingsTotal = charts.ratings.reduce((sum, r) => sum + r.count, 0);

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

                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <StatCard label="Total users" value={stats.users} href={route('admin.users.index')} />
                    <StatCard
                        label="Customers"
                        value={stats.customers}
                        href={route('admin.users.index', { role: 'customer' })}
                    />
                    <StatCard
                        label="Technicians"
                        value={stats.technicians}
                        href={route('admin.users.index', { role: 'technician' })}
                    />
                    <StatCard
                        label="Suspended"
                        value={stats.suspended}
                        alert
                        href={route('admin.users.index', { status: 'suspended' })}
                    />
                    <StatCard label="Categories" value={stats.categories} href={route('admin.categories.index')} />
                    <StatCard label="Conversations" value={stats.conversations} />
                    <StatCard label="Reviews" value={stats.reviews} href={route('admin.reviews.index')} />
                    <StatCard label="Open tickets" value={stats.tickets_open} alert href={route('admin.support.index')} />
                    <StatCard
                        label="Open reports"
                        value={stats.reports_open}
                        alert
                        href={route('admin.reports.index', { status: 'open' })}
                    />
                </div>

                <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Last 30 days</h3>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <StatCard label="New users" value={trends.users.current} trend={trends.users} />
                        <StatCard label="New conversations" value={trends.conversations.current} trend={trends.conversations} />
                        <StatCard label="Messages sent" value={trends.messages.current} trend={trends.messages} />
                        <StatCard label="New reviews" value={trends.reviews.current} trend={trends.reviews} />
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <ChartCard title="Sign-ups" description="New accounts per day, last 30 days">
                        <LineChart
                            labels={dayLabels}
                            series={[{ name: 'Sign-ups', color: CHART_COLORS.indigo, values: charts.signups.map((day) => day.count) }]}
                            emptyMessage="No one has signed up in the last 30 days."
                        />
                    </ChartCard>

                    <ChartCard title="Messages" description="Messages sent per day, last 30 days">
                        <BarChart
                            data={charts.messages.map((day) => ({ label: formatShortDate(day.date), value: day.count }))}
                            color={CHART_COLORS.sky}
                            unit="messages"
                            emptyMessage="No messages have been sent in the last 30 days."
                        />
                    </ChartCard>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <ChartCard title="Users by role">
                        <DonutChart data={slices(ROLE_SLICES, charts.roles)} centerLabel="users" />
                    </ChartCard>

                    <ChartCard title="Technician availability" description="Status technicians have set on their profile">
                        <DonutChart
                            data={slices(AVAILABILITY_SLICES, charts.availability)}
                            centerLabel="technicians"
                            emptyMessage="No technician profiles yet."
                        />
                    </ChartCard>

                    <ChartCard title="Support tickets" description="All tickets by status" className="md:col-span-2 lg:col-span-1">
                        <DonutChart
                            data={slices(TICKET_SLICES, charts.tickets)}
                            centerLabel="tickets"
                            emptyMessage="No support tickets yet."
                        />
                    </ChartCard>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <ChartCard
                        title="Review ratings"
                        description={
                            stats.average_rating === null
                                ? 'How customers rate technicians'
                                : `Average ${stats.average_rating} out of 5 from ${ratingsTotal} review${ratingsTotal === 1 ? '' : 's'}`
                        }
                    >
                        <BarChart
                            data={charts.ratings.map((r) => ({ label: `${r.rating} ★`, value: r.count }))}
                            color={CHART_COLORS.amber}
                            unit="reviews"
                            showValues
                            emptyMessage="No reviews yet."
                        />
                    </ChartCard>

                    <ChartCard title="Technicians by category" description="Most popular categories, by technicians offering them">
                        <HBarChart
                            data={charts.categories.map((c) => ({ label: c.name, value: c.count }))}
                            color={CHART_COLORS.emerald}
                            emptyMessage="No technician has picked a category yet."
                        />
                    </ChartCard>
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
                                    <div className="flex items-center gap-3">
                                        <Avatar user={user} size="sm" />
                                        <div>
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-xs capitalize text-gray-500">{user.role}</div>
                                        </div>
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

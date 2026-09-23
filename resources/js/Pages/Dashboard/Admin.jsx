import { Head, Link } from '@inertiajs/react';
import AdminSidebar from '@/Components/AdminSidebar';
import Avatar from '@/Components/Avatar';
import { BarChart, CHART_COLORS, ChartCard, DonutChart, HBarChart, LineChart } from '@/Components/Charts';
import { Attention, DashboardHeader, Figures, RatingSummary } from '@/Components/Dashboard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatDateTime, formatShortDate } from '@/lib/dates';

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

    return (
        <AuthenticatedLayout>
            <Head title="Admin Dashboard" />

            <div className="flex flex-1 flex-col md:flex-row">
                <AdminSidebar />

                <div className="min-w-0 flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
                    <DashboardHeader title="Platform overview" subtitle="What is waiting for you, and how RepairIT is doing." />

                    <Attention
                        emptyMessage="Nothing is waiting: no open reports, support tickets or suspended accounts."
                        items={[
                            {
                                count: stats.reports_open,
                                singular: 'open report',
                                plural: 'open reports',
                                cta: 'Review reports',
                                href: route('admin.reports.index', { status: 'open' }),
                            },
                            {
                                count: stats.tickets_open,
                                singular: 'open support ticket',
                                plural: 'open support tickets',
                                cta: 'Answer tickets',
                                href: route('admin.support.index'),
                            },
                            {
                                count: stats.suspended,
                                singular: 'suspended account',
                                plural: 'suspended accounts',
                                cta: 'Manage users',
                                href: route('admin.users.index', { status: 'suspended' }),
                            },
                        ]}
                    />

                    <Figures
                        title="Overview"
                        columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
                        items={[
                            { label: 'Users', value: stats.users, href: route('admin.users.index') },
                            { label: 'Customers', value: stats.customers, href: route('admin.users.index', { role: 'customer' }) },
                            { label: 'Technicians', value: stats.technicians, href: route('admin.users.index', { role: 'technician' }) },
                            { label: 'Categories', value: stats.categories, href: route('admin.categories.index') },
                            { label: 'Conversations', value: stats.conversations },
                            { label: 'Reviews', value: stats.reviews, href: route('admin.reviews.index') },
                        ]}
                    />

                    <Figures
                        title="Last 30 days"
                        items={[
                            { label: 'New users', value: trends.users.current, trend: trends.users },
                            { label: 'New conversations', value: trends.conversations.current, trend: trends.conversations },
                            { label: 'Messages sent', value: trends.messages.current, trend: trends.messages },
                            { label: 'New reviews', value: trends.reviews.current, trend: trends.reviews },
                        ]}
                    />

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

                        <ChartCard title="Technician availability" description="Status technicians set on their profile">
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
                        <ChartCard title="Review ratings" description="How customers rate technicians">
                            <RatingSummary distribution={charts.ratings} average={stats.average_rating} emptyMessage="No reviews yet." />
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
                        <ChartCard
                            title="Recent sign-ups"
                            action={
                                <Link
                                    href={route('admin.users.index')}
                                    className="shrink-0 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    All users
                                </Link>
                            }
                        >
                            <ul className="-my-2 divide-y divide-gray-100 text-sm dark:divide-white/10">
                                {recentUsers.map((user) => (
                                    <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar user={user} size="sm" />
                                            <div className="min-w-0">
                                                <div className="truncate font-medium">{user.name}</div>
                                                <div className="text-xs capitalize text-gray-500 dark:text-gray-400">{user.role}</div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatDate(user.created_at)}</span>
                                    </li>
                                ))}
                            </ul>
                        </ChartCard>

                        <ChartCard
                            title="Recent admin activity"
                            action={
                                <Link
                                    href={route('admin.logs.index')}
                                    className="shrink-0 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Full log
                                </Link>
                            }
                        >
                            {recentLogs.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400">Nothing has been logged yet.</p>
                            ) : (
                                <ul className="-my-2 divide-y divide-gray-100 text-sm dark:divide-white/10">
                                    {recentLogs.map((log) => (
                                        <li key={log.id} className="py-3">
                                            <div>{log.description}</div>
                                            <div className="mt-0.5 flex justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="truncate">{log.admin ?? 'Deleted admin'}</span>
                                                <span className="shrink-0">{formatDateTime(log.created_at)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </ChartCard>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

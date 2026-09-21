import { Head, Link } from '@inertiajs/react';
import { BarChart, CHART_COLORS, ChartCard, HBarChart, LineChart } from '@/Components/Charts';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatShortDate } from '@/lib/dates';

export default function Customer({ stats, charts }) {
    const dayLabels = charts.sent.map((day) => formatShortDate(day.date));

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <div className="flex flex-wrap gap-3">
                    <Link
                        href={route('search.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        Search
                    </Link>
                    <Link
                        href={route('conversations.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        View messages
                    </Link>
                    <Link
                        href={route('repairs.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        My repairs
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard label="Conversations" value={stats.conversations} href={route('conversations.index')} />
                    <StatCard label="Unread messages" value={stats.unread} alert href={route('conversations.index')} />
                    <StatCard label="Reviews written" value={stats.reviews} />
                    <StatCard label="Open support tickets" value={stats.tickets_open} href={route('support.index')} />
                </div>

                <ChartCard title="Your messages" description="Messages you sent and received, per day, last 30 days">
                    <LineChart
                        labels={dayLabels}
                        series={[
                            { name: 'Sent', color: CHART_COLORS.indigo, values: charts.sent.map((day) => day.count) },
                            { name: 'Received', color: CHART_COLORS.emerald, values: charts.received.map((day) => day.count) },
                        ]}
                        emptyMessage="No messages yet. Find a technician to start a conversation."
                    />
                </ChartCard>

                <div className="grid gap-6 md:grid-cols-2">
                    <ChartCard title="Repairs you asked about" description="Categories of the technicians you have contacted">
                        <HBarChart
                            data={charts.categories.map((c) => ({ label: c.name, value: c.count }))}
                            color={CHART_COLORS.emerald}
                            emptyMessage="Contact a technician and their categories will show up here."
                        />
                    </ChartCard>

                    <ChartCard title="Ratings you have given" description="How you rated the technicians you reviewed">
                        <BarChart
                            data={charts.ratings.map((r) => ({ label: `${r.rating} ★`, value: r.count }))}
                            color={CHART_COLORS.amber}
                            unit="reviews"
                            showValues
                            emptyMessage="You have not reviewed a technician yet."
                        />
                    </ChartCard>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

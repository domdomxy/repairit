import { Head, usePage } from '@inertiajs/react';
import { CHART_COLORS, ChartCard, HBarChart, LineChart } from '@/Components/Charts';
import { ActionLink, DashboardHeader, Figures, RatingSummary, firstName } from '@/Components/Dashboard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatShortDate } from '@/lib/dates';

export default function Customer({ stats, charts }) {
    const { auth } = usePage().props;
    const dayLabels = charts.sent.map((day) => formatShortDate(day.date));

    return (
        <AuthenticatedLayout>
            <Head title="Dashboard" />

            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <DashboardHeader
                    title={`Welcome back, ${firstName(auth.user)}`}
                    subtitle="Post what needs fixing, or find a technician who can help."
                >
                    <ActionLink href={route('feed.index', { compose: 'request' })} primary>
                        Post a request
                    </ActionLink>
                    <ActionLink href={route('search.index')}>Find a technician</ActionLink>
                    <ActionLink href={route('conversations.index')} badge={stats.unread} badgeLabel="unread">
                        Messages
                    </ActionLink>
                    <ActionLink href={route('repairs.index')}>My repairs</ActionLink>
                </DashboardHeader>

                <Figures
                    items={[
                        { label: 'Conversations', value: stats.conversations, href: route('conversations.index') },
                        { label: 'Unread messages', value: stats.unread, alert: true, href: route('conversations.index') },
                        { label: 'Reviews written', value: stats.reviews },
                        { label: 'Open support tickets', value: stats.tickets_open, href: route('support.index') },
                    ]}
                />

                <ChartCard title="Your messages" description="Sent and received per day, last 30 days">
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
                    <ChartCard title="What you asked about" description="Categories of the technicians you contacted">
                        <HBarChart
                            data={charts.categories.map((c) => ({ label: c.name, value: c.count }))}
                            color={CHART_COLORS.emerald}
                            emptyMessage="Contact a technician and their categories will show up here."
                        />
                    </ChartCard>

                    <ChartCard title="Ratings you gave" description="How you rated the technicians you reviewed">
                        <RatingSummary
                            distribution={charts.ratings}
                            emptyMessage="You have not reviewed a technician yet."
                        />
                    </ChartCard>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

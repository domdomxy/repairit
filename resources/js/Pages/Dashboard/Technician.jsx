import { Head } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { CHART_COLORS, ChartCard, LineChart } from '@/Components/Charts';
import { ActionLink, DashboardHeader, Figures, Headline, RatingSummary, Stars } from '@/Components/Dashboard';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatDate, formatShortDate } from '@/lib/dates';

export default function Technician({ stats, trends, charts, recentReviews }) {
    const dayLabels = charts.received.map((day) => formatShortDate(day.date));

    return (
        <SidebarLayout>
            <Head title="Technician Dashboard" />

            <div className="mx-auto max-w-6xl space-y-6">
                <DashboardHeader title="Dashboard" subtitle="Your inbox, your reputation and the last 30 days of activity.">
                    <ActionLink href={route('conversations.index')} primary badge={stats.unread} badgeLabel="unread">
                        Messages
                    </ActionLink>
                    <ActionLink href={route('technician.offers.index')}>My offers</ActionLink>
                    <ActionLink href={route('technician.repairs.index')}>Repairs</ActionLink>
                    <ActionLink href={route('technician.profile.edit')}>Edit profile</ActionLink>
                </DashboardHeader>

                <Figures
                    items={[
                        { label: 'Conversations', value: stats.conversations, href: route('conversations.index') },
                        { label: 'Unread messages', value: stats.unread, alert: true, href: route('conversations.index') },
                        {
                            label: 'Average rating',
                            value: stats.average_rating === null ? '–' : `${stats.average_rating} ★`,
                            hint: `${stats.reviews} review${stats.reviews === 1 ? '' : 's'}`,
                        },
                        {
                            label: 'Reply rate',
                            value: stats.reply_rate === null ? '–' : `${stats.reply_rate}%`,
                            hint: 'Conversations you have replied in',
                        },
                    ]}
                />

                <div className="grid gap-6 lg:grid-cols-3">
                    <ChartCard
                        title="Message activity"
                        description="Received from customers and sent by you, per day"
                        className="lg:col-span-2"
                    >
                        <div className="mb-5 flex flex-wrap gap-x-10 gap-y-3">
                            <Headline label="New conversations, last 30 days" value={trends.conversations.current} trend={trends.conversations} />
                            <Headline label="Messages received, last 30 days" value={trends.received.current} trend={trends.received} />
                        </div>
                        <LineChart
                            labels={dayLabels}
                            series={[
                                { name: 'Received', color: CHART_COLORS.indigo, values: charts.received.map((day) => day.count) },
                                { name: 'Sent', color: CHART_COLORS.emerald, values: charts.sent.map((day) => day.count) },
                            ]}
                            emptyMessage="No messages in the last 30 days."
                        />
                    </ChartCard>

                    <ChartCard title="Your ratings" description="How customers rate you">
                        <RatingSummary
                            distribution={charts.ratings}
                            average={stats.average_rating}
                            emptyMessage="No customer has reviewed you yet."
                        />
                    </ChartCard>
                </div>

                <ChartCard title="Latest reviews">
                    {recentReviews.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Reviews from your customers will show up here.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100 text-sm dark:divide-white/10">
                            {recentReviews.map((review) => (
                                <li key={review.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                                    <Avatar user={review.customer} name={review.customer?.name ?? 'Deleted user'} size="sm" />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="truncate font-medium">{review.customer?.name ?? 'Deleted user'}</span>
                                            <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                                                {formatDate(review.created_at)}
                                            </span>
                                        </div>
                                        <Stars rating={review.rating} />
                                        {review.comment && (
                                            <p className="mt-1 line-clamp-2 break-words text-gray-600 dark:text-gray-300">{review.comment}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </ChartCard>
            </div>
        </SidebarLayout>
    );
}

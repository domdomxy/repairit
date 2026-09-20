import { Head, Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { BarChart, CHART_COLORS, ChartCard, LineChart } from '@/Components/Charts';
import StatCard from '@/Components/StatCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, formatShortDate } from '@/lib/dates';

function Stars({ rating }) {
    return (
        <span className="text-amber-500" aria-label={`${rating} out of 5`}>
            {'★'.repeat(rating)}
            <span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - rating)}</span>
        </span>
    );
}

export default function Technician({ stats, trends, charts, recentReviews }) {
    const dayLabels = charts.received.map((day) => formatShortDate(day.date));

    return (
        <AuthenticatedLayout>
            <Head title="Technician Dashboard" />

            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <div className="flex flex-wrap gap-3">
                    <Link
                        href={route('conversations.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        View messages
                    </Link>
                    <Link
                        href={route('technician.profile.edit')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        Edit profile
                    </Link>
                    <Link
                        href={route('technician.offers.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        My offers
                    </Link>
                    <Link
                        href={route('technician.repairs.index')}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
                    >
                        Repairs
                    </Link>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <StatCard label="Conversations" value={stats.conversations} href={route('conversations.index')} />
                    <StatCard label="Unread messages" value={stats.unread} alert href={route('conversations.index')} />
                    <StatCard
                        label="Average rating"
                        value={stats.average_rating === null ? '–' : `${stats.average_rating} ★`}
                        hint={`${stats.reviews} review${stats.reviews === 1 ? '' : 's'}`}
                    />
                    <StatCard
                        label="Reply rate"
                        value={stats.reply_rate === null ? '–' : `${stats.reply_rate}%`}
                        hint="Conversations you have replied in"
                    />
                </div>

                <div>
                    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Last 30 days</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard label="New conversations" value={trends.conversations.current} trend={trends.conversations} />
                        <StatCard label="Messages received" value={trends.received.current} trend={trends.received} />
                    </div>
                </div>

                <ChartCard title="Message activity" description="Messages received from customers and sent by you, per day">
                    <LineChart
                        labels={dayLabels}
                        series={[
                            { name: 'Received', color: CHART_COLORS.indigo, values: charts.received.map((day) => day.count) },
                            { name: 'Sent', color: CHART_COLORS.emerald, values: charts.sent.map((day) => day.count) },
                        ]}
                        emptyMessage="No messages in the last 30 days."
                    />
                </ChartCard>

                <div className="grid gap-6 md:grid-cols-2">
                    <ChartCard
                        title="Your ratings"
                        description={
                            stats.average_rating === null
                                ? 'How customers rate you'
                                : `Average ${stats.average_rating} out of 5 from ${stats.reviews} review${stats.reviews === 1 ? '' : 's'}`
                        }
                    >
                        <BarChart
                            data={charts.ratings.map((r) => ({ label: `${r.rating} ★`, value: r.count }))}
                            color={CHART_COLORS.amber}
                            unit="reviews"
                            showValues
                            emptyMessage="No customer has reviewed you yet."
                        />
                    </ChartCard>

                    <ChartCard title="Latest reviews">
                        {recentReviews.length === 0 ? (
                            <p className="text-sm text-gray-500">Reviews from your customers will show up here.</p>
                        ) : (
                            <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-700">
                                {recentReviews.map((review) => (
                                    <li key={review.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                                        <Avatar user={review.customer} name={review.customer?.name ?? 'Deleted user'} size="sm" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate font-medium">{review.customer?.name ?? 'Deleted user'}</span>
                                                <span className="shrink-0 text-xs text-gray-500">{formatDate(review.created_at)}</span>
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
            </div>
        </AuthenticatedLayout>
    );
}

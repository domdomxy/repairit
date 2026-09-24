import Pagination from '@/Components/Pagination';
import ReporterStatusBadge from '@/Components/ReporterStatusBadge';
import { BUTTON_QUIET, CARD, SupportHeader } from '@/Components/SupportUI';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatDateTime } from '@/lib/dates';
import { Head, Link } from '@inertiajs/react';

// What was reported and about whom | why | when | where it stands. On a phone the columns stack.
const ROW = 'grid gap-x-6 gap-y-1 px-5 py-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem_8rem] md:items-center';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The reports I filed, with where each one stands. Opening one shows what I was told.
export default function Index({ reports }) {
    return (
        <SidebarLayout>
            <Head title="My reports" />

            <div className="mx-auto max-w-[96rem]">
                <SupportHeader title="My reports">
                    Everything you reported, and where each report stands. We tell you here and in your notifications when
                    our team has finished looking at one.
                </SupportHeader>

                {reports.data.length === 0 ? (
                    <div className={`${CARD} px-6 py-14 text-center`}>
                        <p className="font-semibold">You have not reported anything</p>
                        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                            If you see a message, a post, a review or a person that breaks the rules, use the report option
                            next to it. It will show up here.
                        </p>
                        <Link href={route('support.index')} className={`${BUTTON_QUIET} mt-5`}>
                            Need help with something else?
                        </Link>
                    </div>
                ) : (
                    <div className={`${CARD} overflow-hidden`}>
                        <div
                            className={`${ROW} hidden border-b border-gray-100 py-3 text-xs font-medium text-gray-500 md:grid dark:border-white/10 dark:text-gray-400`}
                        >
                            <span>Report</span>
                            <span>Reason</span>
                            <span>Sent</span>
                            <span>Status</span>
                        </div>

                        <ul className="divide-y divide-gray-100 dark:divide-white/10">
                            {reports.data.map((report) => (
                                <li key={report.id}>
                                    <Link
                                        href={route('reports.mine.show', report.id)}
                                        className={`${ROW} transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:hover:bg-gray-700/40`}
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-medium">{capitalize(report.target_label)}</p>
                                            {report.about && (
                                                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                                    About <bdi>{report.about}</bdi>
                                                </p>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">{report.reason_label}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {formatDateTime(report.created_at)}
                                        </p>
                                        <div>
                                            <ReporterStatusBadge status={report.status} label={report.status_label} />
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="mt-4">
                    <Pagination links={reports.links} />
                </div>
            </div>
        </SidebarLayout>
    );
}

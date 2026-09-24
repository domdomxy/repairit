import { CheckIcon } from '@/Components/Icons';
import ReporterStatusBadge from '@/Components/ReporterStatusBadge';
import { CARD, SideCard, SupportHeader, WITH_SIDE } from '@/Components/SupportUI';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { Head, Link } from '@inertiajs/react';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// The dot of a step: done, being worked on, or still to come.
function Marker({ state }) {
    if (state === 'done') {
        return (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white ring-4 ring-white dark:ring-gray-800">
                <CheckIcon className="h-4 w-4" />
            </span>
        );
    }

    if (state === 'current') {
        return (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-indigo-100 dark:ring-indigo-500/25">
                <span className="h-2 w-2 rounded-full bg-white" />
            </span>
        );
    }

    return <span className="h-7 w-7 rounded-full border-2 border-gray-200 bg-white ring-4 ring-white dark:border-gray-600 dark:bg-gray-800 dark:ring-gray-800" />;
}

// One report of mine: where it stands, and what we told me at each step.
export default function Show({ report }) {
    return (
        <SidebarLayout>
            <Head title={`Report · ${capitalize(report.target_label)}`} />

            <div className="mx-auto max-w-[96rem]">
                <Link href={route('reports.mine.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← My reports
                </Link>

                <div className="mt-4">
                    <SupportHeader title={`Report about ${report.target_label}`}>
                        {report.about ? (
                            <>
                                About <bdi className="font-medium">{report.about}</bdi> · {report.reason_label}
                            </>
                        ) : (
                            report.reason_label
                        )}
                        {' · '}sent {formatDateTime(report.created_at)}
                    </SupportHeader>
                </div>

                <div className={WITH_SIDE}>
                    <div className="min-w-0 space-y-6">
                        <section className={`${CARD} p-6 sm:p-8`}>
                            <div className="mb-6 flex items-center gap-3">
                                <h2 className="text-lg font-semibold">Progress</h2>
                                <ReporterStatusBadge status={report.status} label={report.status_label} />
                            </div>

                            <ol>
                                {report.timeline.map((step, index) => {
                                    const last = index === report.timeline.length - 1;

                                    return (
                                        <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
                                            {!last && (
                                                <span
                                                    aria-hidden="true"
                                                    className={`absolute start-3.5 top-7 -ms-px h-[calc(100%-1.75rem)] w-0.5 ${
                                                        step.state === 'done' ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                                                    }`}
                                                />
                                            )}
                                            <div className="relative shrink-0">
                                                <Marker state={step.state} />
                                            </div>
                                            <div className="min-w-0 flex-1 pt-0.5">
                                                <p
                                                    className={`font-medium ${
                                                        step.state === 'upcoming' ? 'text-gray-400 dark:text-gray-500' : ''
                                                    }`}
                                                >
                                                    {step.title}
                                                </p>
                                                {step.at && (
                                                    <time
                                                        dateTime={step.at}
                                                        title={formatDateTime(step.at)}
                                                        className="text-xs text-gray-500 dark:text-gray-400"
                                                    >
                                                        {formatDateTime(step.at)} · {relativeTime(step.at)}
                                                    </time>
                                                )}
                                                {step.text && (
                                                    <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
                                                        {step.text}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>

                        {report.details && (
                            <section className={`${CARD} p-6 sm:p-8`}>
                                <h2 className="text-lg font-semibold">What you told us</h2>
                                <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    {report.details}
                                </p>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-6 lg:sticky lg:top-20">
                        <SideCard title="What happens next">
                            <p>
                                {report.status === 'open'
                                    ? 'You do not need to do anything else. Our team is looking at your report, and we will tell you here and in your notifications when we are done.'
                                    : 'Our team has finished with this report. Thank you for helping keep Repairit safe.'}
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                                To protect everyone's privacy, we do not share what was decided about the other person.
                            </p>
                        </SideCard>
                    </aside>
                </div>
            </div>
        </SidebarLayout>
    );
}

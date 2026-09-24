import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import MessageAttachments from '@/Components/MessageAttachments';
import OfferCard from '@/Components/OfferCard';
import RequestCard from '@/Components/RequestCard';
import ReportStatusBadge from '@/Components/ReportStatusBadge';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatDateTime } from '@/lib/dates';
import { reportStatusLabels } from '@/lib/reports';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

// Shared card chrome, used throughout this page so every section reads as
// part of one design instead of a stack of unrelated boxes.
const CARD = 'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800';
const EYEBROW = 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';

// What a report is about, in one glance: an icon and a colour that also show
// up in the header. Kept close to the palette the notification bell already
// uses for its "Reports" category, so the two feel like the same feature.
const TYPE_META = {
    user: {
        label: 'Person',
        bg: 'bg-rose-100 dark:bg-rose-900/40',
        text: 'text-rose-600 dark:text-rose-300',
        icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    },
    review: {
        label: 'Review',
        bg: 'bg-amber-100 dark:bg-amber-900/40',
        text: 'text-amber-600 dark:text-amber-300',
        icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    },
    request: {
        label: 'Request',
        bg: 'bg-sky-100 dark:bg-sky-900/40',
        text: 'text-sky-600 dark:text-sky-300',
        icon: 'M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7.914a2 2 0 00-.586-1.414l-3.914-3.914A2 2 0 0011.086 2H6a2 2 0 00-2 2v14a2 2 0 002 2z',
    },
    offer: {
        label: 'Offer',
        bg: 'bg-violet-100 dark:bg-violet-900/40',
        text: 'text-violet-600 dark:text-violet-300',
        icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    },
    message: {
        label: 'Message',
        bg: 'bg-indigo-100 dark:bg-indigo-900/40',
        text: 'text-indigo-600 dark:text-indigo-300',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    },
    conversation: {
        label: 'Conversation',
        bg: 'bg-indigo-100 dark:bg-indigo-900/40',
        text: 'text-indigo-600 dark:text-indigo-300',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    },
};

// The colour an action button takes on, matching what it will make the
// report's status show elsewhere (green once resolved, amber while open).
const ACTION_STYLES = {
    open: 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20',
    resolved: 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-300 dark:hover:bg-green-900/20',
    dismissed: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700',
};

function SectionHeader({ title, note }) {
    return (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={EYEBROW}>{title}</h3>
            {note && <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>}
        </div>
    );
}

// One message of the reported conversation, as an admin sees it: everything,
// with a note for anything that people can no longer see.
function TranscriptMessage({ message, reportedId }) {
    const fromReported = message.sender_id === reportedId;
    const removed = message.deleted_for_everyone_at !== null;
    const files = message.attachments ?? [];

    return (
        <div id={`message-${message.id}`} className={`flex ${fromReported ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-1">
                <p className={`text-xs text-gray-500 dark:text-gray-400 ${fromReported ? 'text-end' : ''}`}>
                    {message.sender_name} · {formatDateTime(message.created_at)}
                </p>

                <div
                    className={`space-y-2 break-words rounded-2xl px-4 py-2 text-sm ${
                        fromReported
                            ? 'bg-rose-50 text-gray-900 dark:bg-rose-950/40 dark:text-gray-100'
                            : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                    } ${message.flagged ? 'ring-2 ring-amber-500' : ''} ${
                        removed ? 'border border-dashed border-red-400' : ''
                    }`}
                >
                    {message.offer && (
                        <p>
                            Shared an offer:{' '}
                            {message.offer.url ? (
                                <Link href={message.offer.url} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                    {message.offer.title}
                                </Link>
                            ) : (
                                <span className="font-medium">{message.offer.title} (since deleted)</span>
                            )}
                        </p>
                    )}
                    {message.quote && (
                        <p>
                            Sent a quote
                            {message.request && (
                                <>
                                    {' '}
                                    for{' '}
                                    {message.request.url ? (
                                        <Link
                                            href={message.request.url}
                                            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            {message.request.excerpt}
                                        </Link>
                                    ) : (
                                        <span className="font-medium">{message.request.excerpt} (since deleted)</span>
                                    )}
                                </>
                            )}
                            :{' '}
                            <span className="font-medium">
                                {message.quote.summary ?? `${message.quote.price} (since deleted, see its history below)`}
                            </span>
                        </p>
                    )}
                    {message.request && !message.quote && (
                        <p>
                            Shared a request:{' '}
                            {message.request.url ? (
                                <Link href={message.request.url} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                                    {message.request.excerpt}
                                </Link>
                            ) : (
                                <span className="font-medium">{message.request.excerpt} (since deleted)</span>
                            )}
                        </p>
                    )}
                    {message.body ? (
                        <p className="whitespace-pre-line">{message.body}</p>
                    ) : (
                        files.length === 0 &&
                        !message.offer &&
                        !message.request &&
                        !message.quote && <p className="italic text-gray-500 dark:text-gray-400">(no text)</p>
                    )}
                    {files.length > 0 && <MessageAttachments attachments={files} />}
                </div>

                <div className={`flex flex-wrap gap-1.5 text-[11px] ${fromReported ? 'justify-end' : ''}`}>
                    {message.flagged && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Reported message
                        </span>
                    )}
                    {removed && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Deleted for everyone · {formatDateTime(message.deleted_for_everyone_at)}
                        </span>
                    )}
                    {message.deleted_for.map((deletion) => (
                        <span
                            key={deletion.name + deletion.at}
                            className="rounded bg-gray-200 px-1.5 py-0.5 text-gray-700 dark:bg-gray-600 dark:text-gray-200"
                        >
                            Deleted for {deletion.name} · {formatDateTime(deletion.at)}
                        </span>
                    ))}
                </div>

                {message.edits.length > 0 && (
                    <details className={`text-xs text-gray-600 dark:text-gray-400 ${fromReported ? 'text-end' : ''}`}>
                        <summary className="cursor-pointer">
                            Edited {message.edits.length} time{message.edits.length === 1 ? '' : 's'} · last{' '}
                            {formatDateTime(message.edited_at)}
                        </summary>
                        <ol className="mt-1 space-y-1 text-start">
                            {message.edits.map((edit, index) => (
                                <li key={index} className="rounded bg-white p-2 shadow-sm dark:bg-gray-900">
                                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                                        Before the change on {formatDateTime(edit.replaced_at)}
                                    </span>
                                    <span className="whitespace-pre-line">{edit.body ?? '(no text)'}</span>
                                </li>
                            ))}
                        </ol>
                    </details>
                )}
            </div>
        </div>
    );
}

// The reported review as it was when it was reported, with a note if it has been
// changed or deleted since, and a way to remove it.
function ReportedReview({ report, review }) {
    const profileRoute = review.kind === 'customer' ? 'customers.show' : 'technicians.show';

    function remove() {
        if (confirm('Delete this review? This cannot be undone.')) {
            router.delete(route('admin.reports.review.destroy', report.id), { preserveScroll: true });
        }
    }

    return (
        <section className={`${CARD} p-5`}>
            <SectionHeader title="Reported review" note="As it was when it was reported." />

            <p className="text-sm">
                <span className="font-medium">{report.reported.name}</span> wrote this about{' '}
                {review.subject ? (
                    <Link href={route(profileRoute, review.subject.id)} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        {review.subject.name}
                    </Link>
                ) : (
                    <span className="font-medium">a deleted user</span>
                )}{' '}
                <span className="text-gray-500 dark:text-gray-400">({review.kind === 'customer' ? 'a customer' : 'a technician'})</span>
            </p>

            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
                <p className="text-sm font-medium">{review.rating}/5</p>
                {review.comment ? (
                    <p className="mt-1 whitespace-pre-line break-words text-sm">{review.comment}</p>
                ) : (
                    <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">(no comment)</p>
                )}
            </div>

            {!review.exists && (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">This review has been deleted since.</p>
            )}

            {review.exists && review.changed && (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
                    <p className="font-medium text-amber-800 dark:text-amber-300">It has been changed since it was reported. It now says:</p>
                    <p className="mt-1">{review.current_rating}/5</p>
                    {review.current_comment ? (
                        <p className="mt-1 whitespace-pre-line break-words">{review.current_comment}</p>
                    ) : (
                        <p className="mt-1 italic text-gray-500 dark:text-gray-400">(no comment)</p>
                    )}
                </div>
            )}

            {review.exists && (
                <button
                    type="button"
                    onClick={remove}
                    className="mt-4 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                    Delete this review
                </button>
            )}
        </section>
    );
}

// One of the two people involved (reported / reporter), as a labelled row
// rather than its own card — the two now read as one "People" panel.
function PersonRow({ label, accent, person }) {
    return (
        <div className="flex items-start gap-3 p-4">
            <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${accent}`} aria-hidden="true" />
            <Avatar user={person} size="md" />
            <div className="min-w-0 flex-1">
                <p className={EYEBROW}>{label}</p>
                <p className="mt-0.5 truncate font-medium text-gray-900 dark:text-gray-100">{person.name}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{person.email}</p>
                <p className="mt-0.5 text-xs capitalize text-gray-500 dark:text-gray-400">
                    {person.role}
                    {person.suspended && (
                        <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            Suspended
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
}

export default function Show({ report, messages, offer, serviceRequest, review, related }) {
    const [note, setNote] = useState('');
    const [errors, setErrors] = useState({});
    const [processing, setProcessing] = useState(false);

    // Lands on the reported message; a conversation report starts at the end.
    useEffect(() => {
        const target = report.message_id ? document.getElementById(`message-${report.message_id}`) : null;

        target?.scrollIntoView({ block: 'center' });
    }, [report.message_id]);

    function setStatus(status) {
        router.post(
            route('admin.reports.status', report.id),
            { status, note },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onSuccess: () => {
                    setNote('');
                    setErrors({});
                },
                onError: setErrors,
                onFinish: () => setProcessing(false),
            },
        );
    }

    function suspend() {
        if (confirm(`Suspend ${report.reported.name}? They will no longer be able to sign in.`)) {
            router.post(route('admin.users.suspend', report.reported.id), {}, { preserveScroll: true });
        }
    }

    const canSuspend = report.reported.role !== 'admin' && !report.reported.suspended;
    const type = TYPE_META[report.type] ?? TYPE_META.conversation;
    const relatedLabel =
        report.type === 'user' ? 'person' : report.type === 'review' ? 'review' : serviceRequest ? 'request' : offer ? 'offer' : 'conversation';

    return (
        <AdminLayout>
            <Head title={`Report #${report.id}`} />

            <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
                <Link href={route('admin.reports.index')} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    All reports
                </Link>

                <div className={`${CARD} flex flex-wrap items-center justify-between gap-4 p-5`}>
                    <div className="flex items-center gap-4">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${type.bg} ${type.text}`}>
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" d={type.icon} />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Report #{report.id}</h2>
                            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                {type.label} · {report.reason_label} · Filed {formatDateTime(report.created_at)}
                            </p>
                        </div>
                    </div>
                    <ReportStatusBadge status={report.status} />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="space-y-6 lg:col-span-2">
                        {report.details && (
                            <section className={`${CARD} p-5`}>
                                <h3 className={EYEBROW}>What {report.reporter.name} wrote</h3>
                                <p className="mt-2 whitespace-pre-line text-sm">{report.details}</p>
                            </section>
                        )}

                        {review ? (
                            <ReportedReview report={report} review={review} />
                        ) : serviceRequest ? (
                            <section className={`${CARD} p-5`}>
                                <SectionHeader title="Reported request" note="As it is now, which may differ from when it was reported." />

                                {serviceRequest.card ? (
                                    <RequestCard request={serviceRequest.card} className="rounded-lg border dark:border-gray-700" />
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">“{serviceRequest.excerpt}”</span>{' '}
                                        has been deleted since.
                                    </p>
                                )}
                            </section>
                        ) : report.type === 'user' ? (
                            <section className={`${CARD} p-5`}>
                                <h3 className={EYEBROW}>Reported person</h3>
                                <p className="mt-2 text-sm">
                                    {report.reporter.name} reported <span className="font-medium">{report.reported.name}</span>{' '}
                                    as a person, not one message, offer, request or review of theirs. Look at their profile
                                    before deciding.
                                </p>
                                {report.reported.role !== 'admin' && (
                                    <Link
                                        href={route(
                                            report.reported.role === 'technician' ? 'technicians.show' : 'customers.show',
                                            report.reported.id,
                                        )}
                                        className="mt-3 inline-block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                    >
                                        View {report.reported.name}&rsquo;s profile
                                    </Link>
                                )}
                            </section>
                        ) : offer ? (
                            <section className={`${CARD} p-5`}>
                                <SectionHeader title="Reported offer" note="As it is now, which may differ from when it was reported." />

                                {offer.card ? (
                                    <OfferCard offer={offer.card} links={false} />
                                ) : (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        <span className="font-medium text-gray-900 dark:text-gray-100">{offer.title}</span> has
                                        been deleted since.
                                    </p>
                                )}
                            </section>
                        ) : (
                            <section className={`${CARD} p-5`}>
                                <SectionHeader
                                    title="Conversation"
                                    note="The full history, including deleted messages and earlier versions of edited ones."
                                />

                                <div className="space-y-4">
                                    {messages.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">There are no messages.</p>}
                                    {messages.map((message) => (
                                        <TranscriptMessage key={message.id} message={message} reportedId={report.reported.id} />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    <aside className="space-y-6">
                        <section className={`${CARD} divide-y divide-gray-100 dark:divide-gray-700`}>
                            <PersonRow
                                label={review ? 'Wrote the review' : 'Reported user'}
                                accent="bg-rose-400"
                                person={report.reported}
                            />
                            <PersonRow label="Reported by" accent="bg-indigo-400" person={report.reporter} />
                        </section>

                        <section className={`${CARD} p-5`}>
                            <h3 className={EYEBROW}>Decision</h3>

                            {report.reviewer && (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {reportStatusLabels[report.status]} by {report.reviewer}
                                    {report.reviewed_at && ` · ${formatDateTime(report.reviewed_at)}`}
                                </p>
                            )}
                            {report.resolution_note && (
                                <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-2 text-sm dark:bg-gray-900/40">
                                    {report.resolution_note}
                                </p>
                            )}

                            <label htmlFor="note" className="mt-3 block text-xs font-medium text-gray-500 dark:text-gray-400">
                                Note for the record <span className="font-normal">(optional)</span>
                            </label>
                            <textarea
                                id="note"
                                rows={3}
                                maxLength={1000}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                className="mt-1 block w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                            />
                            <InputError message={errors.note} />
                            <InputError message={errors.status} />

                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(reportStatusLabels)
                                    .filter(([value]) => value !== report.status)
                                    .map(([value, label]) => (
                                        <button
                                            key={value}
                                            type="button"
                                            disabled={processing}
                                            onClick={() => setStatus(value)}
                                            className={`rounded-md border px-3 py-1 text-sm font-medium transition disabled:opacity-50 ${
                                                ACTION_STYLES[value] ?? ACTION_STYLES.dismissed
                                            }`}
                                        >
                                            {value === 'open' ? 'Reopen' : `Mark ${label.toLowerCase()}`}
                                        </button>
                                    ))}
                                {note.trim() !== '' && (
                                    <button
                                        type="button"
                                        disabled={processing}
                                        onClick={() => setStatus(report.status)}
                                        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                                    >
                                        Save note only
                                    </button>
                                )}
                            </div>

                            {canSuspend && (
                                <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
                                    <button
                                        type="button"
                                        onClick={suspend}
                                        className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                                    >
                                        Suspend {report.reported.name}
                                    </button>
                                </div>
                            )}
                        </section>

                        {related.length > 0 && (
                            <section className={`${CARD} p-5`}>
                                <h3 className={EYEBROW}>Other reports about this {relatedLabel}</h3>
                                <ul className="mt-2 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                                    {related.map((other) => (
                                        <li key={other.id} className="flex items-center justify-between gap-2 py-2">
                                            <div className="min-w-0">
                                                <Link
                                                    href={route('admin.reports.show', other.id)}
                                                    className="text-indigo-600 hover:underline dark:text-indigo-400"
                                                >
                                                    #{other.id} {other.reason_label}
                                                </Link>
                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                    {other.reporter} · {formatDateTime(other.created_at)}
                                                </p>
                                            </div>
                                            <ReportStatusBadge status={other.status} />
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </aside>
                </div>
            </div>
        </AdminLayout>
    );
}

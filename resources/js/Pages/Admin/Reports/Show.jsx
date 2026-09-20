import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import MessageAttachments from '@/Components/MessageAttachments';
import ReportStatusBadge from '@/Components/ReportStatusBadge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/lib/dates';
import { reportStatusLabels } from '@/lib/reports';
import { Head, Link, router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

// One message of the reported conversation, as an admin sees it: everything,
// with a note for anything that people can no longer see.
function TranscriptMessage({ message, reportedId }) {
    const fromReported = message.sender_id === reportedId;
    const removed = message.deleted_for_everyone_at !== null;
    const files = message.attachments ?? [];

    return (
        <div id={`message-${message.id}`} className={`flex ${fromReported ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-1">
                <p className={`text-xs text-gray-500 ${fromReported ? 'text-end' : ''}`}>
                    {message.sender_name} · {formatDateTime(message.created_at)}
                </p>

                <div
                    className={`space-y-2 break-words rounded-lg px-4 py-2 text-sm ${
                        fromReported
                            ? 'bg-rose-50 text-gray-900 dark:bg-rose-950/40 dark:text-gray-100'
                            : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                    } ${message.flagged ? 'ring-2 ring-amber-500' : ''} ${
                        removed ? 'border border-dashed border-red-400' : ''
                    }`}
                >
                    {message.body ? (
                        <p className="whitespace-pre-line">{message.body}</p>
                    ) : (
                        files.length === 0 && <p className="italic text-gray-500">(no text)</p>
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
                                <li key={index} className="rounded bg-white p-2 shadow-sm dark:bg-gray-800">
                                    <span className="block text-[11px] text-gray-500">
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

export default function Show({ report, messages, related }) {
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

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold">Report #{report.id}</h2>
                        <p className="mt-1 text-xs capitalize text-gray-500">
                            {report.type} report · {report.reason_label} · Filed {formatDateTime(report.created_at)}
                        </p>
                    </div>
                    <ReportStatusBadge status={report.status} />
                </div>
            }
        >
            <Head title={`Report #${report.id}`} />

            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    <Link href={route('admin.reports.index')} className="text-sm text-indigo-600 hover:underline">
                        All reports
                    </Link>

                    {report.details && (
                        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">
                                What {report.reporter.name} wrote
                            </h3>
                            <p className="mt-2 whitespace-pre-line text-sm">{report.details}</p>
                        </section>
                    )}

                    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">Conversation</h3>
                            <p className="text-xs text-gray-500">
                                The full history, including deleted messages and earlier versions of edited ones.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {messages.length === 0 && <p className="text-sm text-gray-500">There are no messages.</p>}
                            {messages.map((message) => (
                                <TranscriptMessage key={message.id} message={message} reportedId={report.reported.id} />
                            ))}
                        </div>
                    </section>
                </div>

                <aside className="space-y-4">
                    {[
                        ['Reported user', report.reported],
                        ['Reported by', report.reporter],
                    ].map(([label, person]) => (
                        <section key={label} className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">{label}</h3>
                            <div className="mt-2 flex items-center gap-3">
                                <Avatar user={person} size="md" />
                                <div className="min-w-0">
                                    <p className="font-medium">{person.name}</p>
                                    <p className="truncate text-sm text-gray-500">{person.email}</p>
                                </div>
                            </div>
                            <p className="mt-1 text-xs capitalize text-gray-500">
                                {person.role}
                                {person.suspended && <span className="ms-2 text-red-600">Suspended</span>}
                            </p>
                        </section>
                    ))}

                    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <h3 className="text-xs font-semibold uppercase text-gray-500">Decision</h3>

                        {report.reviewer && (
                            <p className="mt-2 text-xs text-gray-500">
                                {reportStatusLabels[report.status]} by {report.reviewer}
                                {report.reviewed_at && ` · ${formatDateTime(report.reviewed_at)}`}
                            </p>
                        )}
                        {report.resolution_note && (
                            <p className="mt-2 whitespace-pre-line rounded bg-gray-50 p-2 text-sm dark:bg-gray-900/40">
                                {report.resolution_note}
                            </p>
                        )}

                        <label htmlFor="note" className="mt-3 block text-xs font-medium text-gray-500">
                            Note for the record <span className="font-normal">(optional)</span>
                        </label>
                        <textarea
                            id="note"
                            rows={3}
                            maxLength={1000}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
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
                                        className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
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
                            <button
                                type="button"
                                onClick={suspend}
                                className="mt-4 w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                            >
                                Suspend {report.reported.name}
                            </button>
                        )}
                    </section>

                    {related.length > 0 && (
                        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">
                                Other reports about this conversation
                            </h3>
                            <ul className="mt-2 divide-y divide-gray-100 text-sm dark:divide-gray-700">
                                {related.map((other) => (
                                    <li key={other.id} className="flex items-center justify-between gap-2 py-2">
                                        <div className="min-w-0">
                                            <Link
                                                href={route('admin.reports.show', other.id)}
                                                className="text-indigo-600 hover:underline"
                                            >
                                                #{other.id} {other.reason_label}
                                            </Link>
                                            <p className="truncate text-xs text-gray-500">
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
        </AuthenticatedLayout>
    );
}

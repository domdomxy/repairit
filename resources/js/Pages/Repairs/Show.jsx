import { CheckIcon, PencilIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import RepairProgress from '@/Components/RepairProgress';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import RepairTimeline from '@/Components/RepairTimeline';
import SecondaryButton from '@/Components/SecondaryButton';
import SubmitButton from '@/Components/SubmitButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import GuestLayout from '@/Layouts/GuestLayout';
import { copyText } from '@/lib/clipboard';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { formatSize } from '@/lib/files';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const CARD = 'rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';
const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500';

// The colour strip across the top of the header: where the repair stands at a glance.
const STATUS_BAR = {
    completed: 'bg-green-500',
    cancelled: 'bg-rose-500',
    waiting: 'bg-amber-500',
};

// The link to give the customer: this very page, shown so it can be read, with
// a button to copy it.
function CopyLink({ code, hint }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);
    const url = route('repairs.show', code);

    useEffect(() => () => clearTimeout(timer.current), []);

    async function copy() {
        if (!(await copyText(url))) {
            // Nothing worked: show the link so it can be copied by hand.
            window.prompt('Copy this link:', url);
            return;
        }

        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }

    return (
        <div>
            <h2 className={LABEL}>Tracking link</h2>
            {hint && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
            <p
                className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs leading-relaxed text-gray-700 dark:bg-gray-900/40 dark:text-gray-300"
                dir="ltr"
            >
                {url}
            </p>
            <button
                type="button"
                onClick={copy}
                className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    copied
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
            >
                {copied && <CheckIcon className="h-4 w-4" />}
                {copied ? 'Link copied' : 'Copy link'}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copied' : ''}
            </span>
        </div>
    );
}

// The technician's way to move the repair along: a new status, a note for the
// customer, or both. Each one lands on the timeline.
function UpdateForm({ repair, statuses, limits }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        status: repair.status,
        note: '',
        attachments: [],
    });
    const [fileError, setFileError] = useState(null);

    // Files are checked here first, with the same limits the server enforces,
    // so a mistake is caught before anything is uploaded.
    function addFiles(e) {
        const picked = Array.from(e.target.files ?? []);
        e.target.value = '';

        const kept = [...data.attachments];
        let total = kept.reduce((sum, file) => sum + file.size, 0);
        let problem = null;

        for (const file of picked) {
            const extension = file.name.split('.').pop().toLowerCase();

            if (!limits.extensions.includes(extension)) {
                problem = `${file.name}: that file type is not allowed.`;
            } else if (file.size > limits.max_kb * 1024) {
                problem = `${file.name} is larger than ${limits.max_kb / 1024} MB.`;
            } else if (kept.length >= limits.max_files) {
                problem = `You can attach up to ${limits.max_files} files to one update.`;
            } else if (total + file.size > limits.max_total_kb * 1024) {
                problem = `The files together may not be larger than ${limits.max_total_kb / 1024} MB.`;
            } else {
                kept.push(file);
                total += file.size;
            }
        }

        setFileError(problem);
        setData('attachments', kept);
    }

    function removeFile(index) {
        setFileError(null);
        setData(
            'attachments',
            data.attachments.filter((_, i) => i !== index),
        );
    }

    function submit(e) {
        e.preventDefault();

        post(route('technician.repairs.updates.store', repair.code), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                reset('note', 'attachments');
                setFileError(null);
            },
        });
    }

    // The server names each failing file (attachments.0, attachments.1, ...): show every message once.
    const attachmentErrors = [
        ...new Set(
            Object.entries(errors)
                .filter(([key]) => key === 'attachments' || key.startsWith('attachments.'))
                .map(([, message]) => message),
        ),
    ];

    return (
        <section className={`${CARD} p-6`}>
            <header className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <PencilIcon className="h-5 w-5" />
                </span>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Post an update</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Change the status, write a note, attach files, or any of them. It goes on the timeline
                        {repair.customer ? (
                            <>
                                {' '}
                                and <bdi>{repair.customer.name}</bdi> is notified.
                            </>
                        ) : (
                            '.'
                        )}
                    </p>
                </div>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-5 border-t border-gray-100 pt-6 dark:border-gray-700">
                <div>
                    <InputLabel htmlFor="status" value="Status" />
                    <select
                        id="status"
                        value={data.status}
                        onChange={(e) => setData('status', e.target.value)}
                        className={FIELD}
                    >
                        {Object.entries(statuses).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                    <InputError message={errors.status} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="note" value="Note (optional)" />
                    <textarea
                        id="note"
                        rows={3}
                        maxLength={500}
                        value={data.note}
                        onChange={(e) => setData('note', e.target.value)}
                        placeholder="For example: the new screen arrives on Thursday."
                        className={FIELD}
                    />
                    <InputError message={errors.note} className="mt-2" />
                </div>

                {limits && (
                    <div>
                        <InputLabel htmlFor="attachments" value="Files (optional)" />

                        {data.attachments.length > 0 && (
                            <ul className="mt-2 space-y-2">
                                {data.attachments.map((file, index) => (
                                    <li
                                        key={`${file.name}-${index}`}
                                        className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40"
                                    >
                                        <span aria-hidden="true">📎</span>
                                        <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{file.name}</span>
                                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{formatSize(file.size)}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeFile(index)}
                                            aria-label={`Remove ${file.name}`}
                                            className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <label
                            htmlFor="attachments"
                            className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            <span aria-hidden="true">📎</span>
                            Attach files
                            <input
                                id="attachments"
                                type="file"
                                multiple
                                accept={limits.extensions.map((extension) => `.${extension}`).join(',')}
                                onChange={addFiles}
                                className="sr-only"
                            />
                        </label>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Photos, PDFs and documents. Up to {limits.max_files} files, {limits.max_kb / 1024} MB each.
                        </p>

                        <InputError message={fileError} className="mt-2" />
                        {attachmentErrors.map((message) => (
                            <InputError key={message} message={message} className="mt-2" />
                        ))}
                    </div>
                )}

                <div className="flex justify-end">
                    <SubmitButton disabled={processing}>Post update</SubmitButton>
                </div>
            </form>
        </section>
    );
}

// Title, details, and which customer's account the repair is linked to.
function DetailsForm({ repair, customers, onDone }) {
    const { data, setData, put, processing, errors } = useForm({
        title: repair.title,
        description: repair.description ?? '',
        customer_id: repair.customer?.id ?? '',
    });

    function submit(e) {
        e.preventDefault();

        put(route('technician.repairs.update', repair.code), { preserveScroll: true, onSuccess: onDone });
    }

    return (
        <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
                <InputLabel htmlFor="title" value="What was left with you" />
                <TextInput
                    id="title"
                    className="mt-1 block w-full"
                    maxLength={120}
                    value={data.title}
                    onChange={(e) => setData('title', e.target.value)}
                    required
                />
                <InputError message={errors.title} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor="description" value="Details (optional)" />
                <textarea
                    id="description"
                    rows={3}
                    maxLength={1000}
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    className={FIELD}
                />
                <InputError message={errors.description} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor="customer_id" value="Customer" />
                <select
                    id="customer_id"
                    value={data.customer_id}
                    onChange={(e) => setData('customer_id', e.target.value)}
                    className={FIELD}
                >
                    <option value="">Not linked to an account</option>
                    {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                            {customer.name}
                        </option>
                    ))}
                </select>
                <InputError message={errors.customer_id} className="mt-2" />
            </div>

            <div className="flex justify-end gap-3">
                <SecondaryButton type="button" onClick={onDone}>
                    Cancel
                </SecondaryButton>
                <SubmitButton disabled={processing}>Save</SubmitButton>
            </div>
        </form>
    );
}

// The side card: what was left, who it is linked to, the link to share, and,
// for the technician only, how to edit or delete the tracking.
function AboutCard({ repair, customers, isOwner, isGuest }) {
    const [editing, setEditing] = useState(false);

    function remove() {
        if (!window.confirm(`Delete the tracking of "${repair.title}"? The customer will not be able to follow it any more.`)) {
            return;
        }

        router.delete(route('technician.repairs.destroy', repair.code));
    }

    return (
        <section aria-label="Repair details" className={`${CARD} divide-y divide-gray-100 dark:divide-gray-700`}>
            <div className="p-6">
                <div className="flex items-center justify-between gap-3">
                    <h2 className={LABEL}>Details</h2>
                    {isOwner && !editing && (
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                            Edit
                        </button>
                    )}
                </div>

                {editing ? (
                    <DetailsForm repair={repair} customers={customers} onDone={() => setEditing(false)} />
                ) : (
                    <>
                        {repair.description ? (
                            <p className="mt-2 whitespace-pre-line break-words leading-relaxed text-gray-700 dark:text-gray-300">
                                {repair.description}
                            </p>
                        ) : (
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No details were added.</p>
                        )}

                        {isOwner && (
                            <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
                                {repair.customer ? (
                                    <>
                                        Linked to <bdi className="font-medium">{repair.customer.name}</bdi>: it is in their
                                        list and they are notified of updates.
                                    </>
                                ) : (
                                    'Not linked to an account. Anyone who has the link can follow this repair, even without an account.'
                                )}
                            </p>
                        )}
                    </>
                )}
            </div>

            <div className="p-6">
                <CopyLink code={repair.code} hint={
                        isOwner
                            ? 'Give this to your customer so they can follow along.'
                            : isGuest
                              ? 'Keep this link to come back and check on your repair.'
                              : null
                    } />
            </div>

            {isOwner && (
                <div className="px-6 py-4">
                    <button
                        type="button"
                        onClick={remove}
                        className="text-sm font-medium text-red-600 hover:text-red-500 hover:underline dark:text-red-400"
                    >
                        Delete this tracking
                    </button>
                </div>
            )}
        </section>
    );
}

// What somebody with no account sees around the page: the slim guest bar with the mark and the theme toggle.
function GuestShell({ children }) {
    return <GuestLayout wide>{children}</GuestLayout>;
}

// One tracked repair on its own page: the technician's, and the page the
// customer follows it on. A header with the status and the road so far; below,
// the timeline (with the update form on top, for the technician) beside a card
// with the details and the link to share.
export default function Show({ repair, updates, statuses, isOwner, customers, attachmentLimits }) {
    const { auth } = usePage().props;
    const technician = repair.technician;
    // Somebody following it with just the link: no account, so no top bar, no lists to go back to, no profile to open.
    const isGuest = !auth.user;
    const Shell = isGuest ? GuestShell : AuthenticatedLayout;

    return (
        <Shell>
            <Head title={`${repair.title} · ${repair.code}`} />

            <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
                {!isGuest && (
                    <Link
                        href={isOwner ? route('technician.repairs.index') : route('repairs.index')}
                        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        ← {isOwner ? 'All repairs' : 'My repairs'}
                    </Link>
                )}

                <section className={`${CARD} ${isGuest ? '' : 'mt-4'} overflow-hidden`}>
                    <div className={`h-1.5 ${STATUS_BAR[repair.status] ?? 'bg-indigo-600'}`} />

                    <div className="p-6 sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {repair.code}
                            </span>
                            <RepairStatusBadge status={repair.status} label={repair.status_label} />
                        </div>

                        <h1 className="mt-4 break-words text-3xl font-semibold leading-tight text-gray-900 dark:text-gray-100">
                            {repair.title}
                        </h1>

                        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                            <span title={formatDateTime(repair.updated_at)}>Updated {relativeTime(repair.updated_at)}</span>
                            {!isOwner && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                        Repaired by{' '}
                                        {isGuest ? (
                                            <span className="font-medium text-gray-700 dark:text-gray-200">{technician.name}</span>
                                        ) : (
                                            <Link
                                                href={route('technicians.show', technician.id)}
                                                className="font-medium text-gray-700 hover:underline dark:text-gray-200"
                                            >
                                                {technician.name}
                                            </Link>
                                        )}
                                    </span>
                                </>
                            )}
                        </p>

                        <RepairProgress status={repair.status} statuses={statuses} updates={updates} />
                    </div>
                </section>

                <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                    <div className="min-w-0 space-y-6">
                        {isOwner && <UpdateForm repair={repair} statuses={statuses} limits={attachmentLimits} />}

                        <section className={`${CARD} p-6 sm:p-8`}>
                            <div className="mb-6 flex items-center gap-2">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Updates</h2>
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                    {updates.length}
                                </span>
                            </div>
                            <RepairTimeline updates={updates} />
                        </section>
                    </div>

                    <aside className="lg:sticky lg:top-20">
                        <AboutCard repair={repair} customers={customers} isOwner={isOwner} isGuest={isGuest} />
                    </aside>
                </div>
            </div>
        </Shell>
    );
}

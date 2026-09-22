import Avatar from '@/Components/Avatar';
import { PencilIcon, PinIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { Banner } from '@/Components/ProfileParts';
import RepairProgress from '@/Components/RepairProgress';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import RepairTimeline from '@/Components/RepairTimeline';
import SecondaryButton from '@/Components/SecondaryButton';
import SubmitButton from '@/Components/SubmitButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { copyText } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/dates';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';
const PANEL = `${CARD} p-6`;
const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

// The link to give the customer: this very page, shown so it can be read, with
// a button to copy it.
function CopyLink({ code }) {
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
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 ps-4 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Tracking link
                </p>
                <p className="truncate font-mono text-sm text-gray-700 dark:text-gray-300" dir="ltr">
                    {url}
                </p>
            </div>
            <button
                type="button"
                onClick={copy}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    copied
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
            >
                {copied ? '✓ Link copied' : 'Copy link'}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copied' : ''}
            </span>
        </div>
    );
}

// The technician's way to move the repair along: a new status, a note for the
// customer, or both. Each one lands on the timeline.
function UpdateForm({ repair, statuses }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        status: repair.status,
        note: '',
    });

    function submit(e) {
        e.preventDefault();

        post(route('technician.repairs.updates.store', repair.code), {
            preserveScroll: true,
            onSuccess: () => reset('note'),
        });
    }

    return (
        <section className={`${CARD} p-6 sm:p-8`}>
            <header className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <PencilIcon className="h-5 w-5" />
                </span>
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Post an update</h2>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        Change the status, write a note, or both. It goes on the timeline
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

// What only the technician sees: who it is for, how to edit it, how to delete it.
function ManagePanel({ repair, customers }) {
    const [editing, setEditing] = useState(false);

    function remove() {
        if (!window.confirm(`Delete the tracking of "${repair.title}"? The customer will not be able to follow it any more.`)) {
            return;
        }

        router.delete(route('technician.repairs.destroy', repair.code));
    }

    return (
        <section className={PANEL}>
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Details</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {repair.customer ? (
                            <>
                                Linked to <bdi>{repair.customer.name}</bdi>: it is in their list and they are notified of
                                updates.
                            </>
                        ) : (
                            'Not linked to an account. Give the link to your customer; anyone signed in who has it can follow this repair.'
                        )}
                    </p>
                </div>
                {!editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                        Edit
                    </button>
                )}
            </div>

            {editing && <DetailsForm repair={repair} customers={customers} onDone={() => setEditing(false)} />}

            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-700">
                <button
                    type="button"
                    onClick={remove}
                    className="text-sm font-medium text-red-600 hover:text-red-500 hover:underline dark:text-red-400"
                >
                    Delete this tracking
                </button>
            </div>
        </section>
    );
}

// One tracked repair on its own page: the technician's, and the page the
// customer follows it on. The repair, its update form (for the technician) and
// its timeline are on the left; on the right, who is repairing it and, for the
// technician, how to manage it (below on a small screen).
export default function Show({ repair, updates, statuses, isOwner, customers }) {
    const technician = repair.technician;

    return (
        <AuthenticatedLayout>
            <Head title={`${repair.title} · ${repair.code}`} />

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <Link
                    href={isOwner ? route('technician.repairs.index') : route('repairs.index')}
                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    ← {isOwner ? 'All repairs' : 'My repairs'}
                </Link>

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                    <div className="min-w-0 space-y-6">
                        <section className={`${CARD} p-6 sm:p-8`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 font-mono text-xs tracking-wider text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                        {repair.code}
                                    </span>
                                    <h1 className="mt-2 break-words text-2xl font-semibold leading-tight text-gray-900 dark:text-gray-100">
                                        {repair.title}
                                    </h1>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Last update {formatDateTime(repair.updated_at)}
                                    </p>
                                </div>
                                <RepairStatusBadge status={repair.status} label={repair.status_label} />
                            </div>

                            <RepairProgress status={repair.status} statuses={statuses} updates={updates} />

                            {repair.description && (
                                <div className="mt-6">
                                    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                        Details
                                    </h2>
                                    <p className="mt-2 whitespace-pre-line break-words leading-relaxed text-gray-700 dark:text-gray-300">
                                        {repair.description}
                                    </p>
                                </div>
                            )}

                            <div className="mt-6">
                                <CopyLink code={repair.code} />
                            </div>
                        </section>

                        {isOwner && <UpdateForm repair={repair} statuses={statuses} />}

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

                    <aside className="space-y-6">
                        <section aria-label="Technician" className={`${CARD} overflow-hidden`}>
                            <Banner />

                            <div className="px-6 pb-6">
                                <div className="relative -mt-10 w-fit">
                                    <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                                        <Avatar user={technician} size="lg" />
                                    </div>
                                </div>

                                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    Repaired by
                                </p>
                                <Link
                                    href={route('technicians.show', technician.id)}
                                    className="block break-words text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100"
                                >
                                    {technician.name}
                                </Link>
                                {technician.city && (
                                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                        <PinIcon className="h-4 w-4 text-gray-400" />
                                        <bdi>{technician.city}</bdi>
                                    </p>
                                )}

                                <Link
                                    href={route('technicians.show', technician.id)}
                                    className="mt-5 block rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    View profile
                                </Link>
                            </div>
                        </section>

                        {isOwner && <ManagePanel repair={repair} customers={customers} />}
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

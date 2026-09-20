import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import RepairProgress from '@/Components/RepairProgress';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import RepairTimeline from '@/Components/RepairTimeline';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { copyText } from '@/lib/clipboard';
import { formatDateTime } from '@/lib/dates';
import { Head, Link, router, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';
const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

// The link to give the customer: this very page.
function CopyLink({ code }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    async function copy() {
        const url = route('repairs.show', code);

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
        <>
            <button
                type="button"
                onClick={copy}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
                {copied ? '✓ Link copied' : 'Copy link'}
            </button>
            <span className="sr-only" role="status">
                {copied ? 'Link copied' : ''}
            </span>
        </>
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
        <section className={PANEL}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Post an update</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Change the status, write a note, or both. It goes on the timeline
                {repair.customer ? ` and ${repair.customer.name} is notified.` : '.'}
            </p>

            <form onSubmit={submit} className="mt-4 space-y-4">
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

                <PrimaryButton disabled={processing}>Post update</PrimaryButton>
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

            <div className="flex gap-3">
                <PrimaryButton disabled={processing}>Save</PrimaryButton>
                <SecondaryButton type="button" onClick={onDone}>
                    Cancel
                </SecondaryButton>
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
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Details</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {repair.customer
                            ? `Linked to ${repair.customer.name}: it is in their list and they are notified of updates.`
                            : 'Not linked to an account. Give the link to your customer; anyone signed in who has it can follow this repair.'}
                    </p>
                </div>
                {!editing && (
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="shrink-0 text-sm text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                    >
                        Edit
                    </button>
                )}
            </div>

            {editing && <DetailsForm repair={repair} customers={customers} onDone={() => setEditing(false)} />}

            <div className="mt-6 border-t pt-4 dark:border-gray-700">
                <button type="button" onClick={remove} className="text-sm text-red-600 underline hover:text-red-500">
                    Delete this tracking
                </button>
            </div>
        </section>
    );
}

export default function Show({ repair, updates, statuses, isOwner, customers }) {
    const technician = repair.technician;

    return (
        <AuthenticatedLayout>
            <Head title={`${repair.title} · ${repair.code}`} />

            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
                <Link
                    href={isOwner ? route('technician.repairs.index') : route('repairs.index')}
                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    ← {isOwner ? 'All repairs' : 'My repairs'}
                </Link>

                <section className={PANEL}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="font-mono text-xs tracking-wider text-gray-500">{repair.code}</p>
                            <h2 className="mt-1 break-words text-xl font-semibold">{repair.title}</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Last update {formatDateTime(repair.updated_at)}
                            </p>
                        </div>
                        <RepairStatusBadge status={repair.status} label={repair.status_label} />
                    </div>

                    <RepairProgress status={repair.status} statuses={statuses} updates={updates} />

                    {repair.description && (
                        <p className="mt-6 whitespace-pre-line break-words text-sm text-gray-600 dark:text-gray-300">
                            {repair.description}
                        </p>
                    )}

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 dark:border-gray-700">
                        <Link
                            href={route('technicians.show', technician.id)}
                            className="flex min-w-0 items-center gap-3 hover:opacity-80"
                        >
                            <Avatar user={technician} size="sm" />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">{technician.name}</span>
                                {technician.city && (
                                    <span className="block truncate text-xs text-gray-500">{technician.city}</span>
                                )}
                            </span>
                        </Link>
                        <CopyLink code={repair.code} />
                    </div>
                </section>

                {isOwner && <UpdateForm repair={repair} statuses={statuses} />}

                <section className={PANEL}>
                    <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-gray-100">Updates</h3>
                    <RepairTimeline updates={updates} />
                </section>

                {isOwner && <ManagePanel repair={repair} customers={customers} />}
            </div>
        </AuthenticatedLayout>
    );
}

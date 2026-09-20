import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Pagination from '@/Components/Pagination';
import PrimaryButton from '@/Components/PrimaryButton';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { Head, Link, useForm } from '@inertiajs/react';

const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

// Start tracking something a customer left. Saving opens its page, where the
// link to give the customer is.
function NewRepairForm({ customers }) {
    const { data, setData, post, processing, errors } = useForm({
        title: '',
        description: '',
        customer_id: '',
    });

    function submit(e) {
        e.preventDefault();

        post(route('technician.repairs.store'));
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div>
                <InputLabel htmlFor="title" value="What was left with you" />
                <TextInput
                    id="title"
                    className="mt-1 block w-full"
                    maxLength={120}
                    placeholder="For example: iPhone 12, cracked screen"
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
                <InputLabel htmlFor="customer_id" value="Customer (optional)" />
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
                <p className="mt-1 text-xs text-gray-500">
                    Customers you have a conversation with. A linked customer finds the repair in their list and is
                    notified of every update. Otherwise, give them the link.
                </p>
                <InputError message={errors.customer_id} className="mt-2" />
            </div>

            <PrimaryButton disabled={processing}>Start tracking</PrimaryButton>
        </form>
    );
}

export default function Repairs({ repairs, filter, counts, customers }) {
    const tabs = [
        { value: 'active', label: `Active (${counts.active})` },
        { value: 'closed', label: `Closed (${counts.closed})` },
        { value: 'all', label: 'All' },
    ];

    return (
        <AuthenticatedLayout>
            <Head title="Repairs" />

            <div className="py-12">
                <div className="mx-auto max-w-3xl space-y-6 sm:px-6 lg:px-8">
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <header>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                Track a new repair
                            </h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                When a customer leaves a device or anything else with you, start tracking it. You get a
                                link to give them, and they can check the status whenever they want.
                            </p>
                        </header>

                        <div className="mt-6">
                            <NewRepairForm customers={customers} />
                        </div>
                    </section>

                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <header className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Your repairs</h2>

                            <nav className="flex gap-1" aria-label="Filter repairs">
                                {tabs.map((tab) => (
                                    <Link
                                        key={tab.value}
                                        href={route('technician.repairs.index', { filter: tab.value })}
                                        preserveScroll
                                        aria-current={filter === tab.value ? 'page' : undefined}
                                        className={`rounded-md px-3 py-1 text-sm ${
                                            filter === tab.value
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                    </Link>
                                ))}
                            </nav>
                        </header>

                        <div className="mt-6">
                            {repairs.data.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {filter === 'active'
                                        ? 'Nothing is being tracked right now.'
                                        : 'No repairs here.'}
                                </p>
                            )}

                            <ul className="space-y-3">
                                {repairs.data.map((repair) => (
                                    <li key={repair.code}>
                                        <Link
                                            href={route('repairs.show', repair.code)}
                                            className="flex items-center justify-between gap-4 rounded-md border p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{repair.title}</p>
                                                <p className="mt-1 truncate text-xs text-gray-500">
                                                    <span className="font-mono">{repair.code}</span>
                                                    {repair.customer && <> · {repair.customer.name}</>} · updated{' '}
                                                    {relativeTime(repair.updated_at)}
                                                </p>
                                            </div>
                                            <RepairStatusBadge status={repair.status} label={repair.status_label} />
                                        </Link>
                                    </li>
                                ))}
                            </ul>

                            <Pagination links={repairs.links} />
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

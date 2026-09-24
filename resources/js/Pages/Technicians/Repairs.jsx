import { ChevronRightIcon, WrenchIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import RepairSearch from '@/Components/RepairSearch';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import SegmentedTabs from '@/Components/SegmentedTabs';
import SubmitButton from '@/Components/SubmitButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { REPAIR_FLOW } from '@/lib/repairs';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';

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
        <form onSubmit={submit} className="space-y-5">
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
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Customers you have a conversation with. A linked customer finds the repair in their list and is
                    notified of every update. Otherwise, give them the link.
                </p>
                <InputError message={errors.customer_id} className="mt-2" />
            </div>

            <SubmitButton disabled={processing} className="w-full justify-center">
                Start tracking
            </SubmitButton>
        </form>
    );
}

// How far along the usual road a repair is, as one bar in five parts. "On
// hold" and "cancelled" are not on the road, so their bar stays empty and the
// status pill beside it says why.
function FlowBar({ status }) {
    const step = REPAIR_FLOW.indexOf(status) + 1;

    return (
        <div className="mt-2.5 flex max-w-xs gap-1" aria-hidden="true">
            {REPAIR_FLOW.map((name, index) => (
                <span
                    key={name}
                    className={`h-1 flex-1 rounded-full ${
                        index < step
                            ? status === 'completed'
                                ? 'bg-green-500'
                                : 'bg-indigo-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                />
            ))}
        </div>
    );
}

// One tracked repair in the list: what it is, its code and customer, how far it
// is and when it last moved. The whole row opens it.
function RepairRow({ repair }) {
    return (
        <li>
            <Link
                href={route('repairs.show', repair.code)}
                className="group flex items-center gap-4 px-6 py-4 transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <WrenchIcon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 dark:text-gray-100">{repair.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            {repair.code}
                        </span>
                        {repair.customer && <bdi>{repair.customer.name}</bdi>}
                        <span>Updated {relativeTime(repair.updated_at)}</span>
                    </p>
                    <FlowBar status={repair.status} />
                </div>

                <RepairStatusBadge status={repair.status} label={repair.status_label} />
                <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-gray-500 sm:block dark:text-gray-600" />
            </Link>
        </li>
    );
}

// The technician's repairs: start tracking a new one, and follow the ones already
// tracked. On a wide screen the form sits beside the list.
export default function Repairs({ repairs, filter, filters, counts, customers }) {
    const { auth } = usePage().props;
    const term = filters.q ?? '';
    // Nothing to search until something is tracked (or a search is under way).
    const hasRepairs = counts.active + counts.closed > 0 || term !== '';

    const tabs = [
        { value: 'active', label: 'Active', count: counts.active },
        { value: 'closed', label: 'Closed', count: counts.closed },
        { value: 'all', label: 'All' },
    ].map((tab) => ({
        ...tab,
        // The search stays when the tab changes.
        href: route('technician.repairs.index', { filter: tab.value, ...(term ? { q: term } : {}) }),
    }));

    return (
        <AuthenticatedLayout>
            <Head title="Repairs" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-20 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    <div className="grid min-w-0 flex-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                        <section aria-label="Your repairs" className={`${CARD} overflow-hidden`}>
                            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-5 dark:border-gray-700">
                                <div>
                                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Your repairs</h1>
                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                        What customers left with you, and how far along it is.
                                    </p>
                                </div>

                                <SegmentedTabs label="Filter repairs" tabs={tabs} value={filter} preserveScroll />
                            </header>

                            {hasRepairs && (
                                <div className="border-b border-gray-100 px-6 py-3 dark:border-gray-700">
                                    <RepairSearch
                                        routeName="technician.repairs.index"
                                        params={{ filter }}
                                        value={term}
                                        placeholder="Search by title, code or customer"
                                        label="Search repairs"
                                    />
                                </div>
                            )}

                            {repairs.data.length === 0 ? (
                                <div className="px-6 py-14 text-center">
                                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                                        <WrenchIcon className="h-6 w-6" />
                                    </span>
                                    <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                                        {term !== ''
                                            ? 'No repairs match your search.'
                                            : filter === 'active'
                                              ? 'Nothing is being tracked right now.'
                                              : 'No repairs here.'}
                                    </p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {repairs.data.map((repair) => (
                                        <RepairRow key={repair.code} repair={repair} />
                                    ))}
                                </ul>
                            )}

                            <div className="px-6 empty:hidden">
                                <Pagination links={repairs.links} />
                            </div>
                        </section>

                        {/* Comes first on a small screen: starting to track is what most visits are for. */}
                        <section
                            aria-label="Track a new repair"
                            className={`${CARD} order-first p-6 xl:sticky xl:top-20 xl:order-none`}
                        >
                            <header className="flex items-start gap-4">
                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    <WrenchIcon className="h-5 w-5" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                        Track a new repair
                                    </h2>
                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                        When a customer leaves a device or anything else with you, start tracking it. You
                                        get a link to give them, and they can check the status whenever they want.
                                    </p>
                                </div>
                            </header>

                            <div className="mt-6 border-t border-gray-100 pt-6 dark:border-gray-700">
                                <NewRepairForm customers={customers} />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

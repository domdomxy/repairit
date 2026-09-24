import Avatar from '@/Components/Avatar';
import { WrenchIcon } from '@/Components/Icons';
import Pagination from '@/Components/Pagination';
import RepairSearch from '@/Components/RepairSearch';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import SegmentedTabs from '@/Components/SegmentedTabs';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { relativeTime } from '@/lib/dates';
import { REPAIR_FLOW } from '@/lib/repairs';
import { Head, Link } from '@inertiajs/react';

const TABS = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'In progress' },
    { value: 'closed', label: 'Finished' },
];

const EMPTY_TEXT = {
    all: 'Nothing yet. When a technician starts tracking something for you, it shows up here.',
    active: 'Nothing is being repaired for you right now.',
    closed: 'No finished repairs yet.',
};

// Where a repair is on its usual road (received, diagnosing, in progress, ready,
// completed) as a row of segments that fill up. A repair that is on hold or
// cancelled is off that road, so it has no track.
function RepairTrack({ status }) {
    const step = REPAIR_FLOW.indexOf(status);

    if (step === -1) return null;

    const done = status === 'completed';

    return (
        <div>
            <div
                role="img"
                aria-label={`Step ${step + 1} of ${REPAIR_FLOW.length}`}
                className="flex gap-1.5"
            >
                {REPAIR_FLOW.map((name, index) => (
                    <span
                        key={name}
                        className={`h-1.5 flex-1 rounded-full ${
                            index <= step
                                ? done
                                    ? 'bg-green-500'
                                    : 'bg-indigo-500'
                                : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                    />
                ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Step {step + 1} of {REPAIR_FLOW.length}
            </p>
        </div>
    );
}

// The repairs a technician linked to your account: open one to see where it is.
export default function Index({ repairs, filter, filters, counts }) {
    const term = filters.q ?? '';
    // Nothing to search until something is tracked (or a search is under way).
    const hasRepairs = counts.all > 0 || term !== '';
    const tabs = TABS.map((tab) => ({
        ...tab,
        // The search stays when the tab changes.
        href: route('repairs.index', { ...(tab.value === 'all' ? {} : { filter: tab.value }), ...(term ? { q: term } : {}) }),
        count: counts[tab.value],
    }));

    return (
        <SidebarLayout>
            <Head title="My repairs" />

            <div className="mx-auto w-full max-w-3xl space-y-6">
                <header className="space-y-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My repairs</h1>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            What you left with a technician, and where it is now. You can also open the link a
                            technician gave you.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {hasRepairs && (
                            <RepairSearch
                                routeName="repairs.index"
                                params={filter === 'all' ? {} : { filter }}
                                value={term}
                                placeholder="Search by title, code or technician"
                                label="Search repairs"
                                className="min-w-[14rem] flex-1"
                            />
                        )}
                        <SegmentedTabs label="Filter repairs" tabs={tabs} value={filter} />
                    </div>
                </header>

                {repairs.data.length === 0 && (
                    <div className="rounded-2xl bg-white px-6 py-14 text-center shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
                        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                            <WrenchIcon className="h-6 w-6" />
                        </span>
                        <p className="mx-auto mt-4 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            {term !== '' ? 'No repairs match your search.' : (EMPTY_TEXT[filter] ?? EMPTY_TEXT.all)}
                        </p>
                    </div>
                )}

                <ul className="space-y-4">
                    {repairs.data.map((repair) => (
                        <li key={repair.code}>
                            <Link
                                href={route('repairs.show', repair.code)}
                                className="block space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 transition hover:ring-indigo-300 dark:bg-gray-800 dark:ring-white/10 dark:hover:ring-indigo-500"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Avatar user={repair.technician} size="md" />
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                                {repair.title}
                                            </p>
                                            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                                                {repair.technician.name} · updated {relativeTime(repair.updated_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <RepairStatusBadge status={repair.status} label={repair.status_label} />
                                </div>

                                <RepairTrack status={repair.status} />
                            </Link>
                        </li>
                    ))}
                </ul>

                <Pagination links={repairs.links} />
            </div>
        </SidebarLayout>
    );
}

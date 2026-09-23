import Avatar from '@/Components/Avatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

// A single-path outline icon, so each tab and empty state stays lightweight.
function Icon({ path, className = 'h-5 w-5' }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 ${className}`}
            aria-hidden="true"
        >
            <path d={path} />
        </svg>
    );
}

// One entry per kind: its icon, its accent colour, and the copy that goes with
// it. `undo` is the button that takes the person off the list; `tone` picks
// the accent used for that tab's icon, active state, and empty illustration.
const TABS = [
    {
        key: 'favorite',
        label: 'Favorites',
        icon: 'M12 4.5c1.7-2 5.3-2.3 7.1-.3 1.9 2.1 1.7 5-.4 7.3L12 18l-6.7-6.5c-2.1-2.3-2.3-5.2-.4-7.3 1.8-2 5.4-1.7 7.1.3Z',
        undo: 'Remove',
        empty: 'No favorites yet. Add someone from their profile or from a conversation.',
        tone: 'amber',
    },
    {
        key: 'mute',
        label: 'Muted',
        icon: 'M13.5 6.5 8 10.5H4.5v3H8l5.5 4V6.5ZM17 9.5c.9.9.9 4.1 0 5M19.3 7.2c1.9 1.9 1.9 7.7 0 9.6',
        undo: 'Unmute',
        empty: 'Nobody muted. Muted people can still write to you, without notifications.',
        tone: 'slate',
    },
    {
        key: 'restrict',
        label: 'Restricted',
        icon: 'M12 3.5 19 6.5v5c0 4.5-3 7.6-7 8.9-4-1.3-7-4.4-7-8.9v-5L12 3.5ZM9.5 12l1.8 1.8L14.5 10',
        undo: 'Unrestrict',
        empty: 'Nobody restricted. Restricted people’s messages wait in Requests without notifying you.',
        tone: 'sky',
    },
    {
        key: 'block',
        label: 'Blocked',
        icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
        undo: 'Unblock',
        empty: 'Nobody blocked.',
        tone: 'rose',
    },
];

// Every Tailwind class each tone needs, spelled out so the build keeps them.
const TONES = {
    amber: {
        activeTab: 'border-amber-500 text-amber-700 dark:text-amber-300',
        iconOn: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
        iconOff: 'bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
        count: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        action: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
    },
    slate: {
        activeTab: 'border-slate-500 text-slate-700 dark:text-slate-300',
        iconOn: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
        iconOff: 'bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
        count: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
        badge: 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300',
        action: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
    },
    sky: {
        activeTab: 'border-sky-500 text-sky-700 dark:text-sky-300',
        iconOn: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300',
        iconOff: 'bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
        count: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
        badge: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
        action: 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700',
    },
    rose: {
        activeTab: 'border-rose-500 text-rose-700 dark:text-rose-300',
        iconOn: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
        iconOff: 'bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
        count: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
        action: 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20',
    },
};

// Everyone the signed-in person favorited, muted, restricted or blocked, so they
// can be undone even when there is no conversation or profile to do it from
// (a blocked person can't be found in the search).
export default function Index({ lists }) {
    const [tab, setTab] = useState('favorite');
    const [processing, setProcessing] = useState(false);
    const current = TABS.find(({ key }) => key === tab);
    const tone = TONES[current.tone];
    const people = lists[tab] ?? [];

    function undo(person) {
        router.delete(route('relations.destroy', { user: person.id, relation: tab }), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
        });
    }

    // A blocked person has no page you can open; everyone else does.
    const profileHref = (person) =>
        tab === 'block'
            ? null
            : person.role === 'technician'
              ? route('technicians.show', person.id)
              : person.role === 'customer'
                ? route('customers.show', person.id)
                : null;

    return (
        <AuthenticatedLayout>
            <Head title="Settings" />

            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Only you can see these lists. Nobody is told when you add or remove them.
                </p>

                <div role="tablist" className="mt-6 grid grid-cols-4 border-b border-gray-200 dark:border-gray-700">
                    {TABS.map(({ key, label, icon, tone: t }) => {
                        const selected = tab === key;
                        const count = lists[key]?.length ?? 0;
                        const tt = TONES[t];

                        return (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={selected}
                                onClick={() => setTab(key)}
                                className={`flex flex-col items-center gap-1.5 border-b-2 px-1 pb-3 pt-1 transition ${
                                    selected
                                        ? tt.activeTab
                                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                            >
                                <span
                                    className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                                        selected ? tt.iconOn : tt.iconOff
                                    }`}
                                >
                                    <Icon path={icon} />
                                </span>
                                <span className="flex items-center gap-1 text-xs font-medium">
                                    {label}
                                    {count > 0 && (
                                        <span
                                            className={`rounded-full px-1.5 text-[11px] font-semibold ${
                                                selected ? tt.count : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
                    {people.length === 0 && (
                        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                            <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.iconOn}`}>
                                <Icon path={current.icon} className="h-6 w-6" />
                            </span>
                            <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{current.empty}</p>
                        </div>
                    )}

                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {people.map((person) => {
                            const href = profileHref(person);
                            const identity = (
                                <>
                                    <Avatar user={person} size="md" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {person.name}
                                        </span>
                                        <span
                                            className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium capitalize ${tone.badge}`}
                                        >
                                            {person.role}
                                        </span>
                                    </span>
                                </>
                            );

                            return (
                                <li
                                    key={person.id}
                                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                                >
                                    {href ? (
                                        <Link href={href} className="flex min-w-0 items-center gap-3">
                                            {identity}
                                        </Link>
                                    ) : (
                                        <div className="flex min-w-0 items-center gap-3">{identity}</div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => undo(person)}
                                        disabled={processing}
                                        className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${tone.action}`}
                                    >
                                        {current.undo}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

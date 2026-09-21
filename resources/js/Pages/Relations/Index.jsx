import Avatar from '@/Components/Avatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';

// One tab per kind. `undo` is the button that takes the person off the list.
const TABS = [
    {
        key: 'favorite',
        label: 'Favorites',
        undo: 'Remove',
        empty: 'No favorites yet. Add someone from their profile or from a conversation.',
    },
    {
        key: 'mute',
        label: 'Muted',
        undo: 'Unmute',
        empty: 'Nobody muted. Muted people can still write to you, without notifications.',
    },
    {
        key: 'restrict',
        label: 'Restricted',
        undo: 'Unrestrict',
        empty: 'Nobody restricted. Restricted people’s messages wait in Requests without notifying you.',
    },
    {
        key: 'block',
        label: 'Blocked',
        undo: 'Unblock',
        empty: 'Nobody blocked.',
    },
];

// Everyone the signed-in person favorited, muted, restricted or blocked, so they
// can be undone even when there is no conversation or profile to do it from
// (a blocked person can't be found in the search).
export default function Index({ lists }) {
    const [tab, setTab] = useState('favorite');
    const [processing, setProcessing] = useState(false);
    const current = TABS.find(({ key }) => key === tab);
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
            <Head title="Favorites & blocked" />

            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Favorites &amp; blocked</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Only you can see these lists. Nobody is told when you add or remove them.
                </p>

                <div role="tablist" className="mt-6 grid grid-cols-4 gap-1 rounded-md bg-gray-100 p-1 dark:bg-gray-900">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            onClick={() => setTab(key)}
                            className={`rounded px-2 py-1.5 text-sm font-medium transition ${
                                tab === key
                                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {label}
                            {(lists[key] ?? []).length > 0 && (
                                <span className="ms-1 text-xs text-gray-500 dark:text-gray-400">
                                    {lists[key].length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className="mt-4 overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
                    {people.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                            {current.empty}
                        </p>
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
                                        <span className="block text-xs capitalize text-gray-500 dark:text-gray-400">
                                            {person.role}
                                        </span>
                                    </span>
                                </>
                            );

                            return (
                                <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-3">
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
                                        className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
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

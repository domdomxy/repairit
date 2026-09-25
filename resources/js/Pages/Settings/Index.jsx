import Avatar from '@/Components/Avatar';
import ProfileSidebar from '@/Components/ProfileSidebar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';
import { PlatformIcon, platformOf } from '@/lib/platforms';
import { getTrustedHosts, revokeAllTrustedHosts, revokeTrustedHost, subscribeTrustedHosts } from '@/lib/trustedHosts';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

// The account health tab lives outside TABS below: unlike the relation lists
// it isn't a list of people to undo, so it gets its own nav entry and panel.
const HEALTH_TAB = {
    key: 'health',
    label: 'Account health',
    icon: 'M4.5 12.75l6 6 9-13.5',
};

// What the health badge says and looks like for each status the server sends.
const HEALTH_STATUS = {
    good: {
        label: 'Good standing',
        icon: 'M4.5 12.75l6 6 9-13.5',
        badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        iconOn: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300',
        dot: 'bg-emerald-500',
    },
    warned: {
        label: 'Warned',
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
        badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        iconOn: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    suspended: {
        label: 'Suspended',
        icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
        badge: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
        iconOn: 'bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300',
        dot: 'bg-rose-500',
    },
};

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
    // Not people: the sites whose links open without the "Leaving Repairit" prompt.
    {
        key: 'trusted',
        label: 'Trusted sites',
        icon: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
        undo: 'Remove',
        empty: 'No trusted sites yet. Tick “Trust this site” in the prompt that appears before a link takes you off Repairit.',
        tone: 'indigo',
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
    indigo: {
        activeTab: 'border-indigo-500 text-indigo-700 dark:text-indigo-300',
        iconOn: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
        iconOff: 'bg-gray-100 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
        count: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
        badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
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

// One trusted site: its logo (a globe for a site that is not a well-known
// network), its name and address, and the button that takes it off the list.
function TrustedSiteRow({ host, tone, undo, disabled, onRevoke }) {
    const url = `https://${host}`;
    const name = platformOf(url)?.name;

    return (
        <li className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-gray-50 dark:hover:bg-gray-700/40">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone.iconOn}`}>
                    <PlatformIcon url={url} className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                    {name && <span className="block text-xs text-gray-500 dark:text-gray-400">{name}</span>}
                    <span className="block break-all text-sm font-medium text-gray-900 dark:text-gray-100">{host}</span>
                </span>
            </div>
            <button
                type="button"
                onClick={onRevoke}
                disabled={disabled}
                className={`shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:opacity-60 ${tone.action}`}
            >
                {undo}
            </button>
        </li>
    );
}

// The signed-in person's own standing: whether an admin has warned or
// suspended their account, and the history behind that. A warning counts
// toward the status for 90 days from when it was issued, then clears on its
// own — `expires_at` on each row is when that happens.
function AccountHealthPanel({ health }) {
    const style = HEALTH_STATUS[health.status] ?? HEALTH_STATUS.good;
    const active = health.warnings.filter((warning) => warning.active);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-5">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.iconOn}`}>
                    <Icon path={style.icon} className="h-6 w-6" />
                </span>
                <div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${style.badge}`}>
                        {style.label}
                    </span>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {health.status === 'good' &&
                            'No active warnings. Nothing to do — this is where new warnings would show up.'}
                        {health.status === 'warned' &&
                            `${active.length} active warning${active.length === 1 ? '' : 's'}. Each one clears on its own 90 days after it was issued.`}
                        {health.status === 'suspended' &&
                            `Your account has been suspended${health.suspended_at ? ` on ${formatDate(health.suspended_at)}` : ''}.`}
                    </p>
                </div>
            </div>

            {health.warnings.length === 0 ? (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 px-6 py-14 text-center dark:border-gray-700">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${HEALTH_STATUS.good.iconOn}`}>
                        <Icon path={HEALTH_STATUS.good.icon} className="h-6 w-6" />
                    </span>
                    <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
                        No warnings have ever been issued to your account.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                    {health.warnings.map((warning) => (
                        <li key={warning.id} className="flex items-start gap-3 px-4 py-3">
                            <span
                                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                                    warning.active ? HEALTH_STATUS.warned.dot : 'bg-gray-300 dark:bg-gray-600'
                                }`}
                                aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="break-words text-sm text-gray-800 dark:text-gray-200">{warning.reason}</p>
                                <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                                    Issued {formatDate(warning.issued_at)} ·{' '}
                                    {warning.active
                                        ? `clears ${formatDate(warning.expires_at)}`
                                        : `cleared ${formatDate(warning.expires_at)}`}
                                </p>
                            </div>
                            {warning.active && (
                                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    Active
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Everyone the signed-in person favorited, muted, restricted or blocked, so they
// can be undone even when there is no conversation or profile to do it from
// (a blocked person can't be found in the search).
export default function Index({ lists, health }) {
    const { auth } = usePage().props;
    const [tab, setTab] = useState('favorite');
    const [processing, setProcessing] = useState(false);
    const isHealth = tab === 'health';
    const current = TABS.find(({ key }) => key === tab);
    const tone = current ? TONES[current.tone] : null;

    // The trusted sites are not part of `lists`: they come from the same shared
    // copy the "Leaving Repairit" prompt uses, so ticking "Trust" in the prompt
    // shows up here at once, and revoking here takes effect there.
    const [hosts, setHosts] = useState(getTrustedHosts);
    useEffect(() => subscribeTrustedHosts(setHosts), []);
    const trusted = tab === 'trusted';
    const people = trusted ? [] : (lists[tab] ?? []);

    async function revokeHost(host) {
        setProcessing(true);

        try {
            await revokeTrustedHost(host);
        } catch {
            // Nothing changed: the site stays on the list.
        } finally {
            setProcessing(false);
        }
    }

    async function revokeAll() {
        if (!window.confirm('Remove every trusted site? Links to them will ask before opening again.')) return;

        setProcessing(true);

        try {
            await revokeAllTrustedHosts();
        } catch {
            // Nothing changed: the sites stay on the list.
        } finally {
            setProcessing(false);
        }
    }

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

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-20 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full">
                            {/* The Settings sections, as a vertical nav instead of the row of
                                tabs they used to be — this is the only page that shows them. */}
                            <nav
                                aria-label="Settings sections"
                                role="tablist"
                                aria-orientation="vertical"
                                className="space-y-1 border-t border-gray-100 px-2 pb-2 pt-2 dark:border-gray-700"
                            >
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={isHealth}
                                    onClick={() => setTab('health')}
                                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                        isHealth
                                            ? (HEALTH_STATUS[health.status] ?? HEALTH_STATUS.good).badge
                                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    <Icon path={HEALTH_TAB.icon} className="h-5 w-5 shrink-0" />
                                    <span className="flex-1 truncate text-start">{HEALTH_TAB.label}</span>
                                    <span
                                        className={`h-2 w-2 shrink-0 rounded-full ${(HEALTH_STATUS[health.status] ?? HEALTH_STATUS.good).dot}`}
                                        aria-hidden="true"
                                    />
                                </button>

                                <div className="my-1 border-t border-gray-100 dark:border-gray-700" />

                                {TABS.map(({ key, label, icon, tone: t }) => {
                                    const selected = tab === key;
                                    const count = key === 'trusted' ? hosts.length : (lists[key]?.length ?? 0);
                                    const tt = TONES[t];

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            role="tab"
                                            aria-selected={selected}
                                            onClick={() => setTab(key)}
                                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                                selected ? tt.badge : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            <Icon path={icon} className="h-5 w-5 shrink-0" />
                                            <span className="flex-1 truncate text-start">{label}</span>
                                            {count > 0 && (
                                                <span
                                                    className={`shrink-0 rounded-full px-1.5 text-[11px] font-semibold ${
                                                        selected ? tt.count : 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                                                    }`}
                                                >
                                                    {count}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>
                        </ProfileSidebar>
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        <div>
                            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Only you can see these lists. Nobody is told when you add or remove them.
                            </p>
                        </div>

                        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800">
                            {isHealth && <AccountHealthPanel health={health} />}

                            {!isHealth && (trusted ? hosts.length === 0 : people.length === 0) && (
                                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                                    <span className={`flex h-12 w-12 items-center justify-center rounded-full ${tone.iconOn}`}>
                                        <Icon path={current.icon} className="h-6 w-6" />
                                    </span>
                                    <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{current.empty}</p>
                                </div>
                            )}

                            {!isHealth && (
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
                            )}

                            {!isHealth && trusted && hosts.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {hosts.length} {hosts.length === 1 ? 'site opens' : 'sites open'} without asking first.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={revokeAll}
                                            disabled={processing}
                                            className="shrink-0 rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                        >
                                            Remove all
                                        </button>
                                    </div>

                                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {hosts.map((host) => (
                                            <TrustedSiteRow
                                                key={host}
                                                host={host}
                                                tone={tone}
                                                undo={current.undo}
                                                disabled={processing}
                                                onRevoke={() => revokeHost(host)}
                                            />
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

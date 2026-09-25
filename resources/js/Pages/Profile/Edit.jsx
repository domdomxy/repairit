import Avatar from '@/Components/Avatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import DeactivateUserForm from './Partials/DeactivateUserForm';
import DeleteUserForm from './Partials/DeleteUserForm';
import ManagePeopleForm from './Partials/ManagePeopleForm';
import UpdateAvatarForm from './Partials/UpdateAvatarForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

// Small outline icons for the section list; one path each, so they stay light.
function Icon({ path }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 shrink-0"
            aria-hidden="true"
        >
            <path d={path} />
        </svg>
    );
}

const ICONS = {
    picture: 'M3 8a2 2 0 0 1 2-2h1.5l1.2-1.8A1 1 0 0 1 8.5 4h7a1 1 0 0 1 .8.4L17.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm9 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    profile: 'M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0',
    people: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19m17 0v-1.5a3.5 3.5 0 0 0-2.5-3.35M15 4.2a3.5 3.5 0 0 1 0 6.6M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    password: 'M16.5 10.5V7.5a4.5 4.5 0 1 0-9 0v3M6 10.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1Z',
    deactivate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3-9h6',
    delete: 'M14.7 3.5 21 15.5a2 2 0 0 1-1.8 3H4.8a2 2 0 0 1-1.8-3L9.3 3.5a2 2 0 0 1 3.4 0ZM12 9v4m0 3h.01',
};

// One card per settings section; `id` is what the list on the left scrolls to.
function SettingsCard({ id, danger = false, children }) {
    return (
        <section
            id={id}
            className={`scroll-mt-24 rounded-xl bg-white p-5 shadow-sm sm:p-8 dark:bg-gray-800 ${
                danger ? 'border border-red-200 dark:border-red-900/60' : ''
            }`}
        >
            {children}
        </section>
    );
}

export default function Edit({ mustVerifyEmail, status, avatar, people }) {
    const user = usePage().props.auth.user;

    // Admins can't block or favorite anyone, so they have no "People" section.
    const sections = [
        { id: 'picture', label: 'Profile picture', hint: 'Your photo' },
        { id: 'profile', label: 'Profile information', hint: 'Name, email and emails from us' },
        ...(people ? [{ id: 'people', label: 'People', hint: 'Favorites, muted, restricted, blocked' }] : []),
        { id: 'password', label: 'Password', hint: 'Keep your account safe' },
        { id: 'deactivate', label: 'Deactivate account', hint: 'Pause and hide it' },
        { id: 'delete', label: 'Delete account', hint: 'Remove everything', danger: true },
    ];

    // Highlights the section that is on screen, and follows the scroll.
    const [active, setActive] = useState(sections[0].id);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting);
                if (visible.length > 0) setActive(visible[0].target.id);
            },
            { rootMargin: '-20% 0px -65% 0px' },
        );

        sections.forEach(({ id }) => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
        // The list only changes with `people`, which is fixed for the page's life.
    }, [Boolean(people)]);

    function go(event, id) {
        event.preventDefault();
        setActive(id);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    return (
        <AuthenticatedLayout stickyNav>
            <Head title="Settings" />

            <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
                {/* Who this account is */}
                <header className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm sm:p-6 dark:from-indigo-900/20 dark:to-gray-800">
                    <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                        <Avatar user={user} size="xl" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                            Settings
                        </p>
                        <h1 className="truncate text-xl font-semibold text-gray-900 sm:text-2xl dark:text-gray-100">
                            {user.name}
                        </h1>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                            <span className="truncate">{user.email}</span>
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                                {user.role}
                            </span>
                            {user.created_at && <span className="text-xs">Member since {formatDate(user.created_at)}</span>}
                        </p>
                    </div>
                </header>

                <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
                    {/* The sections: a sticky list on wide screens, a scrolling row of pills on narrow ones. */}
                    <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:w-64 lg:shrink-0">
                        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:rounded-xl lg:bg-white lg:p-2 lg:shadow-sm lg:dark:bg-gray-800">
                            {sections.map(({ id, label, hint, danger }) => {
                                const selected = active === id;

                                return (
                                    <li key={id} className="shrink-0 lg:shrink">
                                        <a
                                            href={`#${id}`}
                                            onClick={(event) => go(event, id)}
                                            aria-current={selected ? 'true' : undefined}
                                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                                                selected
                                                    ? danger
                                                        ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                                        : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200'
                                                    : danger
                                                      ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/10'
                                                      : 'bg-white text-gray-600 hover:bg-gray-100 lg:bg-transparent dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700/50'
                                            }`}
                                        >
                                            <Icon path={ICONS[id]} />
                                            <span className="min-w-0">
                                                <span className="block whitespace-nowrap lg:whitespace-normal">
                                                    {label}
                                                </span>
                                                <span className="hidden text-xs font-normal text-gray-500 lg:block dark:text-gray-400">
                                                    {hint}
                                                </span>
                                            </span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>

                    <div className="min-w-0 flex-1 space-y-6">
                        <SettingsCard id="picture">
                            <UpdateAvatarForm avatar={avatar} className="max-w-xl" />
                        </SettingsCard>

                        <SettingsCard id="profile">
                            <UpdateProfileInformationForm
                                mustVerifyEmail={mustVerifyEmail}
                                status={status}
                                className="max-w-xl"
                            />
                        </SettingsCard>

                        {people && (
                            <SettingsCard id="people">
                                <ManagePeopleForm people={people} className="max-w-2xl" />
                            </SettingsCard>
                        )}

                        <SettingsCard id="password">
                            <UpdatePasswordForm className="max-w-xl" />
                        </SettingsCard>

                        <SettingsCard id="deactivate">
                            <DeactivateUserForm className="max-w-xl" />
                        </SettingsCard>

                        <SettingsCard id="delete" danger>
                            <DeleteUserForm className="max-w-xl" />
                        </SettingsCard>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import Avatar from '@/Components/Avatar';
import { Banner } from '@/Components/ProfileParts';
import SubmitButton from '@/Components/SubmitButton';
import { Description, Field, Label, Switch, Transition } from '@headlessui/react';
import { Link } from '@inertiajs/react';

// Building blocks shared by the two pages where technicians and customers edit
// their public profile.

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';

const HEADER_LINK =
    'rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700';

// Who is being edited: the banner and picture the public profile has, with the
// way to change the picture (it lives on the account page) and to see the result.
// `audience` is who looks at the profile ("customers", "technicians").
export function EditHeader({ user, audience, publicHref }) {
    return (
        <section className={`${CARD} overflow-hidden`}>
            <Banner />

            <div className="px-6 pb-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="relative -mt-12 w-fit">
                        <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                            <Avatar user={user} size="xl" />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Link href={route('profile.edit')} className={HEADER_LINK}>
                            {user.avatar_url ? 'Change picture' : 'Add a picture'}
                        </Link>
                        <Link href={publicHref} className={HEADER_LINK}>
                            View public profile
                        </Link>
                    </div>
                </div>

                <h1 className="mt-3 break-words text-xl font-semibold text-gray-900 dark:text-gray-100">{user.name}</h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Edit what {audience} see on your public profile.
                </p>
            </div>
        </section>
    );
}

// One group of settings: what it is for on the left, its fields on the right
// (stacked on a small screen). `wide` lets the fields use the whole right side,
// for a map.
export function SettingsSection({ title, description, wide = false, children }) {
    return (
        <section className={`${CARD} p-6 sm:p-8`}>
            <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
                <header>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
                </header>

                <div className={`min-w-0 space-y-6 ${wide ? '' : 'max-w-xl'}`}>{children}</div>
            </div>
        </section>
    );
}

// A yes/no setting as a switch, with what it does under its name.
export function ToggleRow({ checked, onChange, label, description }) {
    return (
        <Field className="flex items-start justify-between gap-4">
            <span className="flex flex-col">
                <Label className="cursor-pointer text-sm font-medium text-gray-800 dark:text-gray-100">{label}</Label>
                {description && (
                    <Description className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</Description>
                )}
            </span>

            <Switch
                checked={checked}
                onChange={onChange}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                    checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none mt-0.5 inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                        checked ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                />
            </Switch>
        </Field>
    );
}

// A few choices side by side, one picked (availability, which automatic reply).
// `options` are { value, label, dot? }; `dot` is the class of a coloured dot.
export function OptionCards({ options, value, onChange, label }) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={`grid gap-3 ${options.length === 3 ? 'grid-cols-3' : 'sm:grid-cols-2'}`}
        >
            {options.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                            selected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-200'
                                : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700/50'
                        }`}
                    >
                        {option.dot && <span className={`h-2.5 w-2.5 rounded-full ${option.dot}`} />}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

// The save button, kept in view at the bottom of the screen while the long form
// scrolls, with the confirmation next to it and room for other links (`children`).
export function SaveBar({ processing, saved, children }) {
    return (
        <div className="sticky bottom-4 z-10">
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-white/90 px-5 py-3 shadow-lg ring-1 ring-gray-900/10 backdrop-blur dark:bg-gray-800/90 dark:ring-white/10">
                <SubmitButton disabled={processing}>Save changes</SubmitButton>

                <Transition
                    show={saved}
                    enter="transition ease-in-out"
                    enterFrom="opacity-0"
                    leave="transition ease-in-out"
                    leaveTo="opacity-0"
                >
                    <p className="text-sm text-green-600 dark:text-green-400">✓ Saved</p>
                </Transition>

                {children && <div className="ms-auto flex flex-wrap items-center gap-4 text-sm">{children}</div>}
            </div>
        </div>
    );
}

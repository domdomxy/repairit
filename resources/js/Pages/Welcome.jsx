import { Head, Link } from '@inertiajs/react';
import logoLight from '@/assets/logos/repairit-icon-only-light.png';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
import ThemeToggle from '@/Components/ThemeToggle';
import { ChatIcon, DocumentIcon, TagIcon } from '@/Components/Icons';

const STEPS = [
    {
        number: '01',
        title: 'Describe the job',
        body: 'Say what needs fixing, add a photo or two, and set a budget if you have one in mind.',
        icon: DocumentIcon,
    },
    {
        number: '02',
        title: 'Compare quotes',
        body: 'Nearby technicians in that trade send quotes. Read their ratings, ask questions, pick one.',
        icon: TagIcon,
    },
    {
        number: '03',
        title: 'Message & book',
        body: 'Sort out timing in the same thread, then get on with the rest of your day.',
        icon: ChatIcon,
    },
];

export default function Welcome({ auth, canLogin, canRegister, categories = [] }) {
    return (
        <>
            <Head title="Repairit — local repairs, sorted" />

            <div className="min-h-screen bg-white dark:bg-gray-900">
                {/* Nav */}
                <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
                    <Link href="/" className="flex items-center gap-2.5">
                        <img src={logoLight} alt="" className="h-8 w-8 dark:hidden" />
                        <img src={logoDark} alt="" className="hidden h-8 w-8 dark:block" />
                        <span className="font-display text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                            Repairit
                        </span>
                    </Link>

                    <nav className="flex items-center gap-1">
                        <ThemeToggle className="me-1" />
                        {auth?.user ? (
                            <Link
                                href={route('feed.index')}
                                className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                            >
                                Go to feed
                            </Link>
                        ) : (
                            <>
                                {canLogin && (
                                    <Link
                                        href={route('login')}
                                        className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    >
                                        Log in
                                    </Link>
                                )}
                                {canRegister && (
                                    <Link
                                        href={route('register')}
                                        className="rounded-md bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                                    >
                                        Register
                                    </Link>
                                )}
                            </>
                        )}
                    </nav>
                </header>

                {/* Hero: the one dark, bold moment on the page. */}
                <section className="relative overflow-hidden bg-gray-900">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-0 -right-32 w-96 rotate-12 bg-amber-500/10"
                    />

                    <div className="relative mx-auto max-w-6xl px-6 py-20 lg:px-8 lg:py-28">
                        <h1 className="max-w-2xl font-display text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
                            Fix it once.
                            <br />
                            Fix it right.
                        </h1>
                        <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                            Repairit puts local plumbers, electricians and technicians one
                            message away from the job in front of you — no call-outs, no
                            guessing at a price.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="rounded-md bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
                                >
                                    Post a repair
                                </Link>
                            )}
                            {canRegister && (
                                <Link
                                    href={`${route('register')}?role=technician`}
                                    className="rounded-md border border-gray-600 px-5 py-3 text-sm font-semibold text-white transition hover:border-gray-400"
                                >
                                    Join as a technician
                                </Link>
                            )}
                        </div>

                        {categories.length > 0 && (
                            <div className="mt-14 border-t border-white/10 pt-6">
                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    On the job board
                                </p>
                                <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                                    {categories.map((category) => (
                                        <li key={category.id} className="flex items-center gap-2 text-sm text-gray-300">
                                            <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                                            {category.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>

                {/* How it works: a genuine sequence, so numbering earns its place. */}
                <section className="mx-auto max-w-6xl px-6 py-20 lg:px-8">
                    <h2 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        How it works
                    </h2>

                    <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-3">
                        {STEPS.map(({ number, title, body, icon: Icon }) => (
                            <div key={number} className="border-t-2 border-gray-900 pt-5 dark:border-gray-100">
                                <div className="flex items-center justify-between">
                                    <span className="font-display text-sm font-semibold text-gray-400 dark:text-gray-500">
                                        {number}
                                    </span>
                                    <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                                </div>
                                <h3 className="mt-3 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    {title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                    {body}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Two audiences, two pitches, side by side. */}
                <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-xl border border-gray-200 p-8 dark:border-gray-700">
                            <h3 className="font-display text-xl font-semibold text-gray-900 dark:text-gray-100">
                                Need something fixed?
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                Post the job, get quotes from technicians who cover your
                                area and your trade, and book the one who's the right fit.
                            </p>
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                                >
                                    Post a repair →
                                </Link>
                            )}
                        </div>

                        <div className="rounded-xl bg-gray-900 p-8">
                            <h3 className="font-display text-xl font-semibold text-white">
                                Work in the trades?
                            </h3>
                            <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                List what you cover, and requests in your categories and
                                area land in your feed. Quote the ones you want.
                            </p>
                            {canRegister && (
                                <Link
                                    href={`${route('register')}?role=technician`}
                                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-amber-400 hover:text-amber-300"
                                >
                                    Join as a technician →
                                </Link>
                            )}
                        </div>
                    </div>
                </section>

                <footer className="border-t border-gray-200 py-10 dark:border-gray-800">
                    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 lg:px-8">
                        <div className="flex items-center gap-2.5">
                            <img src={logoLight} alt="" className="h-6 w-6 dark:hidden" />
                            <img src={logoDark} alt="" className="hidden h-6 w-6 dark:block" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Repairit — local repairs, sorted.
                            </span>
                        </div>
                        <div className="flex gap-5 text-sm text-gray-500 dark:text-gray-400">
                            {canLogin && (
                                <Link href={route('login')} className="hover:text-gray-900 dark:hover:text-gray-200">
                                    Log in
                                </Link>
                            )}
                            {canRegister && (
                                <Link href={route('register')} className="hover:text-gray-900 dark:hover:text-gray-200">
                                    Register
                                </Link>
                            )}
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}

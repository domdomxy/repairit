import { Head, Link, useForm } from '@inertiajs/react';
import logoLight from '@/assets/logos/repairit-icon-only-light.png';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
import InputError from '@/Components/InputError';
import ThemeToggle from '@/Components/ThemeToggle';
import {
    CheckIcon,
    ChatIcon,
    DocumentIcon,
    MailIcon,
    PinIcon,
    StarIcon,
    TagIcon,
    WrenchIcon,
} from '@/Components/Icons';

const STEPS = [
    {
        title: 'Describe the job',
        body: 'Say what needs fixing, add a photo or two, and set a budget if you have one in mind.',
        icon: DocumentIcon,
    },
    {
        title: 'Compare quotes',
        body: 'Technicians in that trade send quotes. Read their ratings, ask questions, pick one.',
        icon: TagIcon,
    },
    {
        title: 'Message & book',
        body: 'Sort out timing in the same thread, then get on with the rest of your day.',
        icon: ChatIcon,
    },
];

const FEATURES = [
    {
        title: 'Find by trade and place',
        body: 'Search by category, by city, or within a radius of where you are.',
        icon: PinIcon,
    },
    {
        title: 'Real ratings',
        body: 'Every technician has a profile with reviews from the customers they worked for.',
        icon: StarIcon,
    },
    {
        title: 'One thread, no back and forth',
        body: 'Photos, quotes, locations and files live in the same conversation as the job.',
        icon: ChatIcon,
    },
    {
        title: 'Follow the repair live',
        body: 'A tracking link shows every step, and an email tells you when it moves. No account needed.',
        icon: MailIcon,
    },
];

const EXAMPLE_STEPS = ['Received', 'Diagnosing', 'In progress', 'Ready'];

// An illustration of what the tracking page looks like, not real data.
function TrackingPreview() {
    return (
        <div className="relative">
            <div aria-hidden="true" className="absolute -inset-6 rounded-[2rem] bg-indigo-600/20 blur-3xl" />

            <div className="relative overflow-hidden rounded-2xl bg-gray-800 shadow-2xl ring-1 ring-white/10">
                <div className="h-1.5 bg-indigo-500" />
                <div className="p-6">
                    <div className="flex items-center justify-between">
                        <span className="rounded bg-gray-700 px-2 py-0.5 font-mono text-xs tracking-wider text-gray-300">
                            REP-K7M2QX4N
                        </span>
                        <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                            In progress
                        </span>
                    </div>
                    <p className="mt-4 font-display text-xl font-semibold text-white">Washing machine, won't drain</p>
                    <p className="mt-1 text-xs text-gray-400">Updated 12 minutes ago</p>

                    <ol className="mt-6 flex items-center">
                        {EXAMPLE_STEPS.map((step, index) => {
                            const done = index < 2;
                            const current = index === 2;

                            return (
                                <li key={step} className="flex flex-1 items-center last:flex-none">
                                    <span
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                                            done
                                                ? 'bg-green-500 text-gray-900'
                                                : current
                                                  ? 'bg-indigo-500 text-white ring-4 ring-indigo-500/25'
                                                  : 'bg-gray-700 text-gray-500'
                                        }`}
                                    >
                                        {done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
                                    </span>
                                    {index < EXAMPLE_STEPS.length - 1 && (
                                        <span className={`mx-1.5 h-0.5 flex-1 rounded ${done ? 'bg-green-500' : 'bg-gray-700'}`} />
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    <div className="mt-2 flex justify-between text-[11px] text-gray-400">
                        {EXAMPLE_STEPS.map((step) => (
                            <span key={step}>{step}</span>
                        ))}
                    </div>

                    <div className="mt-6 rounded-xl bg-gray-900/70 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Latest update</p>
                        <p className="mt-1.5 text-sm text-gray-300">The new pump is on its way and fits.</p>
                    </div>
                </div>
            </div>

            <div className="absolute -bottom-5 -left-3 flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-xl sm:-left-8">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <MailIcon className="h-4 w-4" />
                </span>
                <span className="text-xs leading-tight text-gray-600">
                    <span className="block font-semibold text-gray-900">Email sent</span>
                    Your repair moved along
                </span>
            </div>
        </div>
    );
}

// For somebody a technician is repairing something for, who may have no account:
// the code (or the whole link) the technician gave them opens the tracking page.
function TrackRepair() {
    const { data, setData, post, processing, errors } = useForm({ code: '' });

    function submit(e) {
        e.preventDefault();
        post(route('repairs.lookup'));
    }

    return (
        <section id="track-repair" className="scroll-mt-4 mx-auto max-w-6xl px-6 py-20 lg:px-8">
            <div className="grid gap-8 rounded-3xl bg-gray-100 p-8 sm:p-12 lg:grid-cols-2 lg:items-center dark:bg-gray-800/60">
                <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                        <WrenchIcon className="h-5 w-5" />
                    </span>
                    <h2 className="mt-5 font-display text-3xl font-semibold text-gray-900 dark:text-gray-100">
                        Left something with a technician?
                    </h2>
                    <p className="mt-3 leading-relaxed text-gray-600 dark:text-gray-400">
                        Enter the tracking code they gave you, or paste the link, to see how your repair is going. You
                        can even ask to be emailed each update.
                    </p>
                </div>

                <form onSubmit={submit} noValidate>
                    <label htmlFor="repair-code" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tracking code or link
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                            id="repair-code"
                            type="text"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                            placeholder="REP-XXXXXXXX"
                            autoComplete="off"
                            spellCheck={false}
                            dir="ltr"
                            className="min-w-0 flex-1 rounded-xl border-gray-300 py-3 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                        />
                        <button
                            type="submit"
                            disabled={processing}
                            className="shrink-0 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
                        >
                            Track repair
                        </button>
                    </div>
                    <InputError message={errors.code} className="mt-2" />
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">No account needed.</p>
                </form>
            </div>
        </section>
    );
}

export default function Welcome({ auth, canLogin, canRegister, categories = [] }) {
    const navLink =
        'rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white';

    return (
        <>
            <Head title="Repairit — local repairs, sorted" />

            <div className="min-h-screen bg-white dark:bg-gray-900">
                {/* Nav */}
                <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 lg:px-8">
                        <Link href="/" className="flex items-center gap-2.5">
                            <img src={logoLight} alt="" className="h-8 w-8 dark:hidden" />
                            <img src={logoDark} alt="" className="hidden h-8 w-8 dark:block" />
                            <span className="font-display text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                                Repairit
                            </span>
                        </Link>

                        <nav className="flex items-center gap-1">
                            <ThemeToggle className="me-1" />
                            <a href="#how-it-works" className={`hidden sm:block ${navLink}`}>
                                How it works
                            </a>
                            <a href="#track-repair" className={`hidden sm:block ${navLink}`}>
                                Track a repair
                            </a>
                            {auth?.user ? (
                                <Link href={route('feed.index')} className={navLink}>
                                    Go to feed
                                </Link>
                            ) : (
                                <>
                                    {canLogin && (
                                        <Link href={route('login')} className={navLink}>
                                            Log in
                                        </Link>
                                    )}
                                    {canRegister && (
                                        <Link
                                            href={route('register')}
                                            className="ms-1 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                                        >
                                            Get started
                                        </Link>
                                    )}
                                </>
                            )}
                        </nav>
                    </div>
                </header>

                {/* Hero: the one dark, bold moment on the page. */}
                <section className="relative overflow-hidden bg-black">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-24 top-0 h-full w-72 rotate-12 bg-amber-500/10"
                    />

                    <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-28">
                        <div>
                            <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-gray-300 ring-1 ring-white/10">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                Local plumbers, electricians and more
                            </p>
                            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] text-white sm:text-6xl">
                                Fix it once.
                                <br />
                                <span className="text-indigo-400">Fix it right.</span>
                            </h1>
                            <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                                Repairit puts technicians one message away from the job in front of you. No call-outs,
                                no guessing at a price, and you can follow the repair until it's done.
                            </p>

                            <div className="mt-9 flex flex-wrap gap-3">
                                {canRegister && (
                                    <Link
                                        href={route('register')}
                                        className="rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                                    >
                                        Post a repair
                                    </Link>
                                )}
                                {canRegister && (
                                    <Link
                                        href={`${route('register')}?role=technician`}
                                        className="rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                                    >
                                        Join as a technician
                                    </Link>
                                )}
                            </div>
                            <p className="mt-5 text-sm text-gray-500">
                                Already have a code?{' '}
                                <a href="#track-repair" className="font-medium text-gray-300 underline-offset-4 hover:underline">
                                    Track your repair
                                </a>
                            </p>
                        </div>

                        <div className="hidden lg:block">
                            <TrackingPreview />
                        </div>
                    </div>

                    {categories.length > 0 && (
                        <div className="relative border-t border-white/10">
                            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-5 lg:px-8">
                                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                    On the job board
                                </span>
                                {categories.map((category) => (
                                    <span key={category.id} className="flex items-center gap-2 text-sm text-gray-300">
                                        <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                                        {category.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* How it works: a genuine sequence, so it is numbered and connected. */}
                <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24 lg:px-8">
                    <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">How it works</p>
                    <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold text-gray-900 sm:text-4xl dark:text-gray-100">
                        From broken to booked in three steps
                    </h2>

                    <ol className="mt-14 grid gap-10 sm:grid-cols-3">
                        {STEPS.map(({ title, body, icon: Icon }, index) => (
                            <li key={title} className="relative">
                                {index < STEPS.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute start-14 top-6 hidden h-px w-[calc(100%-2rem)] bg-gray-200 sm:block dark:bg-gray-700"
                                    />
                                )}
                                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <p className="mt-5 font-display text-sm font-semibold text-gray-400 dark:text-gray-500">
                                    0{index + 1}
                                </p>
                                <h3 className="mt-1 font-display text-xl font-semibold text-gray-900 dark:text-gray-100">
                                    {title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* What sets it apart. */}
                <section className="border-y border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-gray-800/40">
                    <div className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
                        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Why Repairit</p>
                        <h2 className="mt-2 max-w-xl font-display text-3xl font-semibold text-gray-900 sm:text-4xl dark:text-gray-100">
                            Everything about the job in one place
                        </h2>

                        <div className="mt-12 grid gap-4 sm:grid-cols-2">
                            {FEATURES.map(({ title, body, icon: Icon }) => (
                                <div
                                    key={title}
                                    className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10"
                                >
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <h3 className="mt-4 font-display text-lg font-semibold text-gray-900 dark:text-gray-100">
                                        {title}
                                    </h3>
                                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <TrackRepair />

                {/* Two audiences, two pitches, side by side. */}
                <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-3xl border border-gray-200 p-9 dark:border-gray-700">
                            <h3 className="font-display text-2xl font-semibold text-gray-900 dark:text-gray-100">
                                Need something fixed?
                            </h3>
                            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                Post the job, get quotes from technicians who cover your area and your trade, and book
                                the one who's the right fit.
                            </p>
                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                                >
                                    Post a repair
                                </Link>
                            )}
                        </div>

                        <div className="rounded-3xl bg-black p-9 ring-1 ring-white/10">
                            <h3 className="font-display text-2xl font-semibold text-white">Work in the trades?</h3>
                            <p className="mt-3 text-sm leading-relaxed text-gray-400">
                                List what you cover, and requests in your categories and area land in your feed. Quote the
                                ones you want, then keep your customers posted as you go.
                            </p>
                            {canRegister && (
                                <Link
                                    href={`${route('register')}?role=technician`}
                                    className="mt-6 inline-flex rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-amber-300"
                                >
                                    Join as a technician
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
                            <span className="text-sm text-gray-500 dark:text-gray-400">Repairit — local repairs, sorted.</span>
                        </div>
                        <div className="flex gap-5 text-sm text-gray-500 dark:text-gray-400">
                            <a href="#track-repair" className="hover:text-gray-900 dark:hover:text-gray-200">
                                Track a repair
                            </a>
                            <Link href={route('support.guest.create')} className="hover:text-gray-900 dark:hover:text-gray-200">
                                Get support
                            </Link>
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

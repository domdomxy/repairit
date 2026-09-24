import ThemeToggle from '@/Components/ThemeToggle';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
import logoLight from '@/assets/logos/repairit-icon-only-light.png';
import { Link } from '@inertiajs/react';
import { ChatIcon, MailIcon, TagIcon } from '@/Components/Icons';

// What's on the job board, for the panel's punch list. Same six trades the
// app seeds categories with (see CategorySeeder) — real content, not filler.
const TRADES = ['Plumbing', 'Electrical', 'Appliance repair', 'HVAC', 'Carpentry', 'Painting'];

// What an account gets you, in the plate's own words.
const PERKS = [
    { icon: TagIcon, text: 'Compare quotes from technicians near you' },
    { icon: ChatIcon, text: 'One thread for photos, prices and timing' },
    { icon: MailIcon, text: 'Follow every repair until it is done' },
];

// The shared shell for every guest page (login, register, password reset,
// email verification): a fixed dark "equipment plate" on the left carrying
// the mark and what the job board covers, and the page's own form on the
// right. The plate stays dark in both themes — a stamped plate doesn't
// change with the light — so it always uses the light (white-stroke) mark;
// the toggle only affects the form side.
//
// `wide` is for the guest support pages, which have more to show than a short
// form. They leave the dark plate out altogether: a slim bar with the mark and the
// theme toggle on top, and the whole width below it for the page's own columns.
// Login, register and the like keep the plate and the narrow centred column.
export default function GuestLayout({ children, wide = false }) {
    if (wide) {
        return (
            <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between px-6 py-4 sm:px-10 lg:px-14">
                    <Link href="/" className="flex items-center gap-3">
                        <img src={logoLight} alt="" className="block h-9 w-9 dark:hidden" />
                        <img src={logoDark} alt="" className="hidden h-9 w-9 dark:block" />
                        <span className="font-display text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Repairit</span>
                    </Link>
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 flex-col px-6 pb-10 sm:px-10 lg:px-14">
                    <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col">{children}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-white lg:flex-row dark:bg-gray-900">
            {/* The plate: always dark, like the welcome page's hero. On a phone it shrinks to the mark alone. */}
            <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-black px-6 py-6 sm:px-10 lg:w-[30rem] lg:px-12 lg:py-12">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_75%)]"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -right-16 w-40 rotate-12 bg-amber-500/10"
                />
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-24 -left-24 hidden h-72 w-72 rounded-full bg-indigo-600/25 blur-3xl lg:block"
                />

                <Link href="/" className="relative flex items-center gap-3">
                    <img src={logoDark} alt="" className="h-9 w-9" />
                    <span className="font-display text-lg font-semibold tracking-tight text-white">Repairit</span>
                </Link>

                <div className="relative hidden lg:block">
                    <p className="font-display text-4xl font-semibold leading-[1.1] text-white">
                        Fix it once.
                        <br />
                        <span className="text-indigo-400">Fix it right.</span>
                    </p>
                    <ul className="mt-8 space-y-4">
                        {PERKS.map(({ icon: Icon, text }) => (
                            <li key={text} className="flex items-center gap-3 text-sm text-gray-300">
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-indigo-300">
                                    <Icon className="h-4 w-4" />
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="relative hidden lg:block">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">On the job board</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                        {TRADES.map((trade) => (
                            <li
                                key={trade}
                                className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-300 ring-1 ring-white/10"
                            >
                                {trade}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col">
                {/* From lg up the two corner controls float instead of taking a row of their own,
                    so a tall form (register) isn't pushed past the bottom of the window. */}
                <div className="flex items-center justify-between px-6 py-4 sm:px-10 lg:absolute lg:inset-x-0 lg:top-0 lg:px-12">
                    <Link
                        href="/"
                        className="text-sm text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        ← Back to home
                    </Link>
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10 lg:py-16">
                    <div className="w-full max-w-md">{children}</div>
                </div>
            </div>
        </div>
    );
}

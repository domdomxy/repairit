import ThemeToggle from '@/Components/ThemeToggle';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
import logoLight from '@/assets/logos/repairit-icon-only-light.png';
import { Link } from '@inertiajs/react';

// What's on the job board, for the panel's punch list. Same six trades the
// app seeds categories with (see CategorySeeder) — real content, not filler.
const TRADES = ['Plumbing', 'Electrical', 'Appliance repair', 'HVAC', 'Carpentry', 'Painting'];

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
            <div className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-gray-900 px-6 py-10 sm:px-10 lg:w-[26rem] lg:px-12 lg:py-14">
                {/* A single diagonal stripe, the panel's one accent — a hazard-tape
                    cue borrowed from the job site, not a decorative gradient. */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -right-16 w-40 rotate-12 bg-amber-500/10"
                />

                <Link href="/" className="relative flex items-center gap-3">
                    <img src={logoDark} alt="" className="h-9 w-9" />
                    <span className="font-display text-lg font-semibold tracking-tight text-white">
                        Repairit
                    </span>
                </Link>

                <div className="relative mt-12 lg:mt-0">
                    <p className="font-display text-3xl font-semibold leading-tight text-white lg:text-4xl">
                        Fix it once.
                        <br />
                        Fix it right.
                    </p>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed text-gray-400">
                        Repairit puts local plumbers, electricians and technicians one
                        message away from the job in front of you.
                    </p>
                </div>

                <div className="relative mt-12 hidden lg:block">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        On the job board
                    </p>
                    <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-300">
                        {TRADES.map((trade) => (
                            <li key={trade} className="flex items-center gap-2">
                                <span className="h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                                {trade}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="relative flex min-w-0 flex-1 flex-col">
                {/* From lg up the toggle floats in the corner instead of taking a row of its own,
                    so a tall form (register) isn't pushed past the bottom of the window. */}
                <div className="flex justify-end px-6 py-4 sm:px-10 lg:absolute lg:right-0 lg:top-0">
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10 lg:py-6">
                    <div className="w-full max-w-sm">{children}</div>
                </div>
            </div>
        </div>
    );
}

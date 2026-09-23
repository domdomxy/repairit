import ThemeToggle from '@/Components/ThemeToggle';
import logoDark from '@/assets/logos/repairit-icon-only-dark.png';
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
export default function GuestLayout({ children }) {
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

            <div className="flex flex-1 flex-col">
                <div className="flex justify-end px-6 py-4 sm:px-10">
                    <ThemeToggle />
                </div>

                <div className="flex flex-1 items-center justify-center px-6 pb-16 sm:px-10">
                    <div className="w-full max-w-sm">{children}</div>
                </div>
            </div>
        </div>
    );
}

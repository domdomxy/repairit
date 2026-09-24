import { CheckIcon } from '@/Components/Icons';
import { REPAIR_FLOW } from '@/lib/repairs';

// Where a repair is on its usual road: done steps filled, the current one
// ringed, a bar running through them. "On hold" keeps the last step reached and
// says so; a cancelled repair has no road left, so it says that instead.
// `updates` is the timeline, newest first.
export default function RepairProgress({ status, statuses, updates }) {
    if (status === 'cancelled') {
        return (
            <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
                This repair was cancelled.
            </p>
        );
    }

    // The step the repair is at; when it is on hold, the last one it reached.
    const step = REPAIR_FLOW.includes(status)
        ? status
        : updates.find((update) => REPAIR_FLOW.includes(update.status))?.status;
    const active = REPAIR_FLOW.indexOf(step);
    const paused = status === 'waiting';
    const finished = status === 'completed';
    const fill = active < 0 ? 0 : (active / (REPAIR_FLOW.length - 1)) * 100;

    return (
        <div className="mt-8 border-t border-gray-100 pt-8 dark:border-gray-700">
            <div className="relative">
                {/* The bar runs from the first circle's centre to the last one's (five equal columns: 10% to 90%). */}
                <div aria-hidden="true" className="absolute inset-x-[10%] top-[18px] h-1 -translate-y-1/2 rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${
                            finished ? 'bg-green-500' : paused ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${fill}%` }}
                    />
                </div>

                <ol className="relative flex">
                    {REPAIR_FLOW.map((name, index) => {
                        const done = index < active || (index === active && finished);
                        const current = index === active && !done;

                        let circle = 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500';
                        if (done) {
                            circle = finished ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white';
                        } else if (current) {
                            circle = paused
                                ? 'border-2 border-amber-500 bg-white text-amber-600 dark:bg-gray-800'
                                : 'border-2 border-indigo-600 bg-white text-indigo-600 dark:bg-gray-800';
                        }

                        return (
                            <li key={name} className="flex-1 text-center" aria-current={current ? 'step' : undefined}>
                                <span
                                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ring-4 ${
                                        current
                                            ? paused
                                                ? 'ring-amber-100 dark:ring-amber-500/20'
                                                : 'ring-indigo-100 dark:ring-indigo-500/20'
                                            : 'ring-white dark:ring-gray-800'
                                    } ${circle}`}
                                >
                                    {done ? <CheckIcon className="h-4 w-4" /> : index + 1}
                                </span>
                                <span
                                    className={`mt-3 block px-1 text-xs sm:text-sm ${
                                        done || current
                                            ? 'font-semibold text-gray-900 dark:text-gray-100'
                                            : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                >
                                    {statuses[name]}
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {paused && (
                <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Currently {statuses.waiting.toLowerCase()}.
                </p>
            )}
        </div>
    );
}

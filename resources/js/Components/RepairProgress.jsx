import { REPAIR_FLOW } from '@/lib/repairs';

// Where a repair is on its usual road, as numbered steps: done ones filled,
// the current one outlined. "On hold" keeps the last step reached and says so;
// a cancelled repair has no road left, so it says that instead.
// `updates` is the timeline, newest first.
export default function RepairProgress({ status, statuses, updates }) {
    if (status === 'cancelled') {
        return (
            <p className="mt-6 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
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

    return (
        <div className="mt-6 rounded-xl bg-gray-50 px-4 py-5 dark:bg-gray-900/40">
            <ol className="flex items-start">
                {REPAIR_FLOW.map((name, index) => {
                    const done = index < active || (index === active && status === 'completed');
                    const current = index === active && !done;

                    let circle = 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400';
                    if (done) {
                        circle = finished ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white';
                    } else if (current) {
                        circle = paused
                            ? 'border-2 border-amber-500 bg-white text-amber-600 dark:bg-gray-900'
                            : 'border-2 border-indigo-600 bg-white text-indigo-600 dark:bg-gray-900';
                    }

                    return (
                        <li
                            key={name}
                            className="relative flex-1 text-center"
                            aria-current={current ? 'step' : undefined}
                        >
                            {index > 0 && (
                                <span
                                    aria-hidden="true"
                                    className={`absolute left-[-50%] top-[15px] h-0.5 w-full ${
                                        index <= active
                                            ? finished
                                                ? 'bg-green-500'
                                                : 'bg-indigo-600'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                    }`}
                                />
                            )}
                            <span
                                className={`relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${circle}`}
                            >
                                {done ? '✓' : index + 1}
                            </span>
                            <span
                                className={`mt-2 block px-1 text-xs ${
                                    done || current
                                        ? 'font-medium text-gray-900 dark:text-gray-100'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                {statuses[name]}
                            </span>
                        </li>
                    );
                })}
            </ol>

            {paused && (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                    Currently {statuses.waiting.toLowerCase()}.
                </p>
            )}
        </div>
    );
}

// The usual road of a repair, in order. Mirrors Repair::FLOW on the server;
// "on hold" and "cancelled" are not on it. The labels come from the server.
export const REPAIR_FLOW = ['received', 'diagnosing', 'in_progress', 'ready', 'completed'];

export const repairStatusStyles = {
    received: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    diagnosing: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    waiting: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    in_progress: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    ready: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
};

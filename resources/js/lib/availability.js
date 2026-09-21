// How a technician's availability status is shown: its label, the colour of
// its dot, and the tint of a pill that carries it.
export const AVAILABILITY = {
    available: {
        label: 'Available',
        dot: 'bg-green-500',
        pill: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    busy: {
        label: 'Busy',
        dot: 'bg-amber-500',
        pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
    offline: {
        label: 'Offline',
        dot: 'bg-gray-400',
        pill: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    },
};

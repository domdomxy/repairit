import { useSyncExternalStore } from 'react';

// The theme lives on <html class="dark"> (applied before first paint by a small
// script in app.blade.php), so every toggle on the page reads it from there and
// they always agree.
function subscribe(callback) {
    window.addEventListener('themechange', callback);

    return () => window.removeEventListener('themechange', callback);
}

const isDark = () => document.documentElement.classList.contains('dark');

const SUN_PATH =
    'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z';
const MOON_PATH =
    'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z';

const ROW_BASE = 'flex w-full items-center gap-2 transition duration-150 ease-in-out focus:outline-none ';

const VARIANTS = {
    // A round icon button, for pages with no menu (the welcome page, the login pages).
    icon: {
        base: 'inline-flex items-center justify-center rounded-md p-2 text-gray-500 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 ',
        size: 'h-5 w-5',
        labelled: false,
    },
    // A row in the account dropdown, styled like its links.
    menu: {
        base:
            ROW_BASE +
            'px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-gray-100 focus:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 dark:focus:bg-gray-800 ',
        size: 'h-4 w-4',
        labelled: true,
    },
    // A row in the feed's account rail, styled like its links.
    sidebar: {
        base:
            ROW_BASE +
            'gap-3 rounded-lg px-3 py-2 text-start text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 ',
        size: 'h-5 w-5 text-gray-400',
        labelled: true,
    },
    // A row in the phone menu, styled like its links.
    responsive:
        {
            base:
                ROW_BASE +
                'border-l-4 border-transparent py-2 pe-4 ps-3 text-start text-base font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 focus:border-gray-300 focus:bg-gray-50 focus:text-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200 dark:focus:border-gray-600 dark:focus:bg-gray-700 dark:focus:text-gray-200 ',
            size: 'h-5 w-5',
            labelled: true,
        },
};

export default function ThemeToggle({ className = '', variant = 'icon' }) {
    const dark = useSyncExternalStore(subscribe, isDark, () => false);
    const { base, size, labelled } = VARIANTS[variant] ?? VARIANTS.icon;

    function toggle() {
        const next = !isDark();

        document.documentElement.classList.toggle('dark', next);

        try {
            localStorage.setItem('theme', next ? 'dark' : 'light');
        } catch {
            // Storage can be blocked (private mode); the theme still switches for this visit.
        }

        window.dispatchEvent(new Event('themechange'));
    }

    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

    return (
        <button type="button" onClick={toggle} title={label} aria-label={label} className={base + className}>
            {/* Sun while dark (click for light), moon while light (click for dark). */}
            <svg className={size} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={dark ? SUN_PATH : MOON_PATH} />
            </svg>
            {labelled && <span>{dark ? 'Light mode' : 'Dark mode'}</span>}
        </button>
    );
}

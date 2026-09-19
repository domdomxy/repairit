import { useSyncExternalStore } from 'react';

// The theme lives on <html class="dark"> (applied before first paint by a small
// script in app.blade.php), so every toggle on the page reads it from there and
// they always agree.
function subscribe(callback) {
    window.addEventListener('themechange', callback);

    return () => window.removeEventListener('themechange', callback);
}

const isDark = () => document.documentElement.classList.contains('dark');

export default function ThemeToggle({ className = '' }) {
    const dark = useSyncExternalStore(subscribe, isDark, () => false);

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
        <button
            type="button"
            onClick={toggle}
            title={label}
            aria-label={label}
            className={
                'inline-flex items-center justify-center rounded-md p-2 text-gray-500 transition duration-150 ease-in-out hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 ' +
                className
            }
        >
            {dark ? (
                // Sun: currently dark, click for light
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                    />
                </svg>
            ) : (
                // Moon: currently light, click for dark
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
                    />
                </svg>
            )}
        </button>
    );
}

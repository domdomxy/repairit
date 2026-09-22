import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    // Dark mode follows the .dark class on <html> (set by the theme toggle),
    // not the OS setting directly.
    darkMode: 'class',

    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.jsx',
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            // Dark mode is built almost entirely from two shades: gray-900 for
            // the page itself, gray-800 for everything that sits on top of it
            // (cards, panels, menus, inputs...). Overriding just these two
            // keeps every existing `dark:bg-gray-900` / `dark:bg-gray-800`
            // class working, but swaps them for a true-black page and a
            // clearly-lighter-but-still-dark surface for content, instead of
            // Tailwind's default blue-tinted grays.
            colors: {
                gray: {
                    900: '#000000',
                    800: '#141414',
                },
            },
        },
    },

    plugins: [forms],
};

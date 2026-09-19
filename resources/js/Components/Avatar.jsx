import { useEffect, useState } from 'react';

// Full class names on purpose: Tailwind only keeps classes it can read in the source.
const SIZES = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
    xl: 'h-24 w-24 text-3xl',
};

// Placeholder colours, picked from the name so a person always gets the same one.
const COLORS = [
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
    'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200',
    'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
];

function initialsOf(name) {
    const words = (name ?? '').trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function colorOf(name) {
    let hash = 0;
    for (const character of name ?? '') hash = (hash * 31 + character.charCodeAt(0)) >>> 0;

    return COLORS[hash % COLORS.length];
}

/**
 * A round profile picture, or the person's initials when they have none.
 *
 * Give it a `user` (anything with `name` and `avatar_url`), or pass `src` and
 * `name` directly, e.g. to preview a picture that has not been uploaded yet.
 * The picture is decoration next to a name that is already on the page, so it
 * has no alt text of its own.
 */
export default function Avatar({ user, src, name, size = 'md', className = '' }) {
    const url = src !== undefined ? src : user?.avatar_url;
    const label = name ?? user?.name ?? '';
    const [failed, setFailed] = useState(false);

    // A new picture gets a fresh chance to load.
    useEffect(() => setFailed(false), [url]);

    const base = `${SIZES[size] ?? SIZES.md} shrink-0 rounded-full ${className}`;

    if (url && !failed) {
        return (
            <img
                src={url}
                alt=""
                loading="lazy"
                onError={() => setFailed(true)}
                className={`${base} object-cover`}
            />
        );
    }

    return (
        <span
            aria-hidden="true"
            className={`${base} ${colorOf(label)} inline-flex select-none items-center justify-center font-semibold`}
        >
            {initialsOf(label)}
        </span>
    );
}

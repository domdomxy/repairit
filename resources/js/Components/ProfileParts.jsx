// Building blocks shared by the technician and customer profile pages.

// The two side panels stay in view and scroll on their own (the middle column
// uses the page's scrollbar). Below `lg` they stack like any block. The offsets
// assume the sticky top bar (4rem) plus 1rem of breathing room.
export const SIDE_PANEL =
    'scroll-on-hover w-full self-start rounded-lg bg-white shadow dark:bg-gray-800 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:w-72 lg:shrink-0 lg:overflow-y-auto xl:w-1/4';

// A small caps heading with its content, for the sections of the side panels.
export function Section({ title, children }) {
    return (
        <section className="py-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {title}
            </h4>
            <div className="mt-2">{children}</div>
        </section>
    );
}

// One way to reach someone; a link the browser can act on (call, email).
export function ContactRow({ icon, label, value, href }) {
    return (
        <a
            href={href}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <span className="block break-words text-sm font-medium text-gray-800 dark:text-gray-100">{value}</span>
            </span>
        </a>
    );
}

export function Stat({ label, children }) {
    return (
        <div className="px-2 py-3 text-center">
            <div className="flex items-center justify-center gap-1 text-base font-semibold text-gray-900 dark:text-gray-100">
                {children}
            </div>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</div>
        </div>
    );
}

// The soft banner and the row of three stats are the same on both profiles.
export function Banner() {
    return (
        <div className="h-24 bg-gradient-to-br from-indigo-500 via-indigo-500 to-purple-500 dark:from-indigo-700 dark:via-indigo-800 dark:to-purple-800" />
    );
}

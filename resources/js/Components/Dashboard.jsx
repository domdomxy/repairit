import { CHART_COLORS, ChartCard, ChartEmpty } from '@/Components/Charts';
import { Trend } from '@/Components/StatCard';
import { Link } from '@inertiajs/react';

/**
 * Building blocks shared by the three dashboards (customer, technician, admin),
 * so they read as one family: a header with the person's actions, one strip of
 * headline figures, and panels (ChartCard) for everything else.
 */

const FOCUS =
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';
const FOCUS_INSET = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500';

/** "Dominic Smith" => "Dominic". */
export function firstName(user) {
    return (user?.name ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * The top of a dashboard: what the page is, and the few things a person does most.
 * The actions (ActionLink) go in as children and wrap under the title on phones.
 */
export function DashboardHeader({ title, subtitle, children }) {
    return (
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
            </div>
            {children && <div className="flex flex-wrap gap-2">{children}</div>}
        </header>
    );
}

/**
 * A link styled as a button. One `primary` per dashboard; the rest are quiet.
 * badge: a count shown as a pill (e.g. unread messages); badgeLabel is what a screen reader hears after it.
 */
export function ActionLink({ href, primary = false, badge = 0, badgeLabel = '', children }) {
    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${FOCUS} ${
                primary
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-gray-700 shadow-sm ring-1 ring-gray-900/10 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-gray-700'
            }`}
        >
            {children}
            {badge > 0 && (
                <span
                    className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                        primary ? 'bg-white/25 text-white' : 'bg-indigo-600 text-white'
                    }`}
                >
                    {badge}
                    {badgeLabel && <span className="sr-only"> {badgeLabel}</span>}
                </span>
            )}
        </Link>
    );
}

function Figure({ label, value, href, alert = false, hint, trend }) {
    const body = (
        <>
            <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p
                className={`mt-1 font-display text-3xl font-semibold tabular-nums ${
                    alert && Number(value) > 0 ? 'text-red-600 dark:text-red-400' : ''
                }`}
            >
                {value}
            </p>
            {trend && <Trend trend={trend} />}
            {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </>
    );

    const cell = 'block h-full bg-white p-5 dark:bg-gray-800';

    return href ? (
        <Link href={href} className={`${cell} transition hover:bg-gray-50 dark:hover:bg-gray-700/40 ${FOCUS_INSET}`}>
            {body}
        </Link>
    ) : (
        <div className={cell}>{body}</div>
    );
}

/**
 * The headline numbers as one card divided into cells, not a card per number.
 *
 * items:   [{ label, value, href?, alert?, hint?, trend? }]. `href` makes the cell a link, `alert`
 *          turns the number red while it is above 0, `trend` ({ current, previous }) adds the change
 *          against the previous 30 days.
 * columns: Tailwind grid classes. Pick a count that fills the last row: the 1px gap shows through
 *          any empty cell.
 * title:   an optional heading above the cells.
 */
export function Figures({ items, title, columns = 'grid-cols-2 md:grid-cols-4', className = '' }) {
    return (
        <section
            className={`overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10 ${className}`}
        >
            {title && <h2 className="px-5 pb-3 pt-5 font-semibold">{title}</h2>}
            <div className={`grid gap-px bg-gray-100 dark:bg-white/10 ${title ? 'border-t border-gray-100 dark:border-white/10' : ''} ${columns}`}>
                {items.map((item) => (
                    <Figure key={item.label} {...item} />
                ))}
            </div>
        </section>
    );
}

/**
 * One number that introduces the chart under it (a panel's own headline), with its trend.
 * Use a row of these at the top of a ChartCard instead of a separate card of stats.
 */
export function Headline({ label, value, trend }) {
    return (
        <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
            {trend && <Trend trend={trend} />}
        </div>
    );
}

/**
 * A queue of things waiting for the person, each a link to where they are dealt with.
 * Rows with a count of 0 are left out; when none is left the panel says so.
 *
 * items: [{ count, singular, plural, cta, href }], e.g. { count: 3, singular: 'open report', plural: 'open reports', cta: 'Review reports', href }
 */
export function Attention({ title = 'Needs attention', items, emptyMessage }) {
    const waiting = items.filter((item) => item.count > 0);

    return (
        <ChartCard title={title}>
            {waiting.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
            ) : (
                <ul className="-my-3 divide-y divide-gray-100 dark:divide-white/10">
                    {waiting.map((item) => (
                        <li key={item.singular}>
                            <Link
                                href={item.href}
                                className={`group flex items-center justify-between gap-4 rounded-lg py-3 ${FOCUS}`}
                            >
                                <span className="flex items-center gap-3 text-sm">
                                    <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                    <span>
                                        <span className="font-semibold tabular-nums">{item.count.toLocaleString()}</span>{' '}
                                        {item.count === 1 ? item.singular : item.plural}
                                    </span>
                                </span>
                                <span className="shrink-0 text-sm font-medium text-indigo-600 group-hover:underline dark:text-indigo-400">
                                    {item.cta}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </ChartCard>
    );
}

/** Filled and empty stars for a whole rating from 1 to 5. */
export function Stars({ rating }) {
    return (
        <span className="text-amber-500" aria-label={`${rating} out of 5`}>
            {'★'.repeat(rating)}
            <span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - rating)}</span>
        </span>
    );
}

/**
 * The average up front, then how many reviews gave each rating as a share of all of them.
 *
 * distribution: [{ rating, count }] for 1 to 5, as the dashboards receive it.
 * average:      when the server already worked it out; otherwise it is worked out from the distribution.
 */
export function RatingSummary({ distribution, average = null, emptyMessage = 'No reviews yet.' }) {
    const total = distribution.reduce((sum, r) => sum + r.count, 0);

    if (total === 0) return <ChartEmpty>{emptyMessage}</ChartEmpty>;

    const mean = average ?? Math.round((distribution.reduce((sum, r) => sum + r.rating * r.count, 0) / total) * 10) / 10;

    return (
        <div>
            <div className="flex items-end gap-3">
                <p className="font-display text-5xl font-semibold leading-none tabular-nums">{mean}</p>
                <div className="pb-0.5">
                    <Stars rating={Math.min(5, Math.max(1, Math.round(mean)))} />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {total.toLocaleString()} review{total === 1 ? '' : 's'}
                    </p>
                </div>
            </div>

            <ul className="mt-5 space-y-2">
                {[...distribution].reverse().map((r) => (
                    <li key={r.rating} className="flex items-center gap-3 text-sm">
                        <span className="w-8 shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{r.rating} ★</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                            <div
                                className="h-full rounded-full"
                                style={{ width: `${(r.count / total) * 100}%`, backgroundColor: CHART_COLORS.amber }}
                            />
                        </div>
                        <span className="w-8 shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.count}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

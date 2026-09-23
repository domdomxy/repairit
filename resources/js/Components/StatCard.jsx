import { Link } from '@inertiajs/react';

/**
 * "Up 25% on the previous 30 days" for a stat card.
 *
 * `trend` is { current, previous }: the count for the last 30 days and for the
 * 30 days before that. Every figure it is used for is one where more is better.
 */
export function Trend({ trend, days = 30 }) {
    const { current, previous } = trend;
    const suffix = `vs previous ${days} days`;

    if (previous === 0 && current === 0) {
        return <p className="mt-1 text-xs text-gray-500">No activity in the last {days * 2} days</p>;
    }

    if (previous === 0) {
        return (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                ▲ New activity <span className="text-gray-500">{suffix}</span>
            </p>
        );
    }

    const change = Math.round(((current - previous) / previous) * 100);

    if (change === 0) {
        return <p className="mt-1 text-xs text-gray-500">No change {suffix}</p>;
    }

    const up = change > 0;

    return (
        <p className={`mt-1 text-xs ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {up ? '▲' : '▼'} {Math.abs(change)}% <span className="text-gray-500">{suffix}</span>
        </p>
    );
}

/**
 * One headline number.
 *
 * href:  makes the whole card a link.
 * alert: colours the number red while it is above 0 (something needs attention).
 * hint:  a line of small text under the number.
 * trend: { current, previous } adds the change against the previous period.
 */
export default function StatCard({ label, value, href, alert = false, hint, trend }) {
    const body = (
        <div className="h-full rounded-lg bg-white p-5 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-semibold ${alert && Number(value) > 0 ? 'text-red-600' : ''}`}>{value}</p>
            {trend && <Trend trend={trend} />}
            {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
    );

    return href ? (
        <Link href={href} className="block h-full transition hover:opacity-80">
            {body}
        </Link>
    ) : (
        body
    );
}

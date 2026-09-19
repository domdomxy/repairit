import { useEffect, useRef, useState } from 'react';

/**
 * Small dependency-free charts for the dashboards.
 *
 * Everything is drawn as SVG or plain HTML and coloured with Tailwind classes,
 * so light and dark mode work with no extra code. Series colours are hex values
 * that read well on both backgrounds.
 */

export const CHART_COLORS = {
    indigo: '#6366f1',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    sky: '#0ea5e9',
    purple: '#a855f7',
    gray: '#9ca3af',
};

const AXIS_TEXT = 'fill-gray-500 dark:fill-gray-400';
const GRID_LINE = 'stroke-gray-200 dark:stroke-gray-700';

/** Measures the width of an element, so the SVG can be drawn at real pixel size (crisp text on phones too). */
function useWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const element = ref.current;
        if (!element) return undefined;

        const update = () => setWidth(element.clientWidth);
        update();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', update);
            return () => window.removeEventListener('resize', update);
        }

        const observer = new ResizeObserver(update);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return [ref, width];
}

/** Whole-number axis ticks from 0 up to just above `max`, e.g. [0, 5, 10, 15]. */
function niceTicks(max, count = 4) {
    if (max <= 0) return [0, 1];

    const rough = max / count;
    const magnitude = 10 ** Math.floor(Math.log10(rough));
    const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough));
    const ticks = [];

    for (let value = 0; value < max + step; value += step) {
        ticks.push(value);
        if (value >= max) break;
    }

    return ticks;
}

/** Roughly every nth index so the x labels never touch. */
function labelStep(count, innerWidth, minGap = 64) {
    const fit = Math.max(1, Math.floor(innerWidth / minGap));
    return Math.max(1, Math.ceil(count / fit));
}

function Tooltip({ x, width, children }) {
    // Keep the box inside the chart near the left and right edges.
    const left = Math.min(Math.max(x, 56), Math.max(width - 56, 56));

    return (
        <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
            style={{ left }}
        >
            {children}
        </div>
    );
}

export function Legend({ items }) {
    return (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
            {items.map((item) => (
                <li key={item.name} className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                </li>
            ))}
        </ul>
    );
}

export function ChartEmpty({ children, height = 160 }) {
    return (
        <div
            className="flex items-center justify-center rounded-md border border-dashed border-gray-300 px-4 text-center text-sm text-gray-500 dark:border-gray-600"
            style={{ minHeight: height }}
        >
            {children}
        </div>
    );
}

/** The white card every chart sits in, matching the dashboards' other panels. */
export function ChartCard({ title, description, className = '', children }) {
    return (
        <section className={`min-w-0 rounded-lg bg-white p-5 shadow dark:bg-gray-800 ${className}`}>
            <h3 className="font-semibold">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
            <div className="mt-4">{children}</div>
        </section>
    );
}

/**
 * One or more lines over time.
 *
 * labels: x-axis text, one per point.
 * series: [{ name, color, values: number[] }], each as long as labels.
 */
export function LineChart({ labels, series, height = 220, emptyMessage = 'Nothing to show yet.' }) {
    const [ref, width] = useWidth();
    const [hover, setHover] = useState(null);

    const pad = { top: 12, right: 12, bottom: 26, left: 34 };
    const total = series.reduce((sum, s) => sum + s.values.reduce((a, b) => a + b, 0), 0);
    const max = Math.max(0, ...series.flatMap((s) => s.values));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];

    const innerW = Math.max(width - pad.left - pad.right, 0);
    const innerH = height - pad.top - pad.bottom;
    const count = labels.length;
    const x = (i) => pad.left + (count === 1 ? innerW / 2 : (i * innerW) / (count - 1));
    const y = (value) => pad.top + innerH * (1 - value / top);
    const step = labelStep(count, innerW);

    function onMove(event) {
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = innerW === 0 || count === 1 ? 0 : (event.clientX - box.left - pad.left) / innerW;
        setHover(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
    }

    return (
        <div>
            {series.length > 1 && <Legend items={series} />}
            <div ref={ref} className="relative w-full min-w-0">
                {total === 0 ? (
                    <ChartEmpty height={height}>{emptyMessage}</ChartEmpty>
                ) : (
                    width > 0 && (
                        <>
                            <svg
                                className="block"
                                width={width}
                                height={height}
                                role="img"
                                aria-label={`Line chart: ${series.map((s) => `${s.name} ${s.values.reduce((a, b) => a + b, 0)}`).join(', ')} over ${count} days`}
                            >
                                {ticks.map((tick) => (
                                    <g key={tick}>
                                        <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={GRID_LINE} strokeWidth="1" />
                                        <text x={pad.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" className={AXIS_TEXT}>
                                            {tick}
                                        </text>
                                    </g>
                                ))}

                                {labels.map((label, i) =>
                                    i % step === 0 ? (
                                        <text key={label + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" className={AXIS_TEXT}>
                                            {label}
                                        </text>
                                    ) : null,
                                )}

                                {series.map((s) => {
                                    const line = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ');
                                    const area = `${line} L${x(count - 1)},${y(0)} L${x(0)},${y(0)} Z`;

                                    return (
                                        <g key={s.name}>
                                            {series.length === 1 && <path d={area} fill={s.color} opacity="0.12" />}
                                            <path d={line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                                        </g>
                                    );
                                })}

                                {hover !== null && (
                                    <g>
                                        <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} className="stroke-gray-400" strokeDasharray="3 3" />
                                        {series.map((s) => (
                                            <circle key={s.name} cx={x(hover)} cy={y(s.values[hover])} r="4" fill={s.color} stroke="white" strokeWidth="1.5" />
                                        ))}
                                    </g>
                                )}

                                <rect
                                    x={pad.left}
                                    y={pad.top}
                                    width={innerW}
                                    height={innerH}
                                    fill="transparent"
                                    style={{ touchAction: 'pan-y' }}
                                    onPointerMove={onMove}
                                    onPointerDown={onMove}
                                    onPointerLeave={() => setHover(null)}
                                />
                            </svg>

                            {hover !== null && (
                                <Tooltip x={x(hover)} width={width}>
                                    <div className="font-medium">{labels[hover]}</div>
                                    {series.map((s) => (
                                        <div key={s.name} className="flex items-center gap-1.5">
                                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                                            {s.name}: {s.values[hover].toLocaleString()}
                                        </div>
                                    ))}
                                </Tooltip>
                            )}
                        </>
                    )
                )}
            </div>
        </div>
    );
}

/**
 * Vertical bars, one per label.
 *
 * data: [{ label, value }]. Set `showValues` for few bars (e.g. ratings 1 to 5)
 * so each bar carries its number; with many bars the tooltip shows it instead.
 */
export function BarChart({ data, color = CHART_COLORS.indigo, height = 220, showValues = false, unit = '', emptyMessage = 'Nothing to show yet.' }) {
    const [ref, width] = useWidth();
    const [hover, setHover] = useState(null);

    const pad = { top: showValues ? 20 : 12, right: 12, bottom: 26, left: 34 };
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
    const top = ticks[ticks.length - 1];

    const innerW = Math.max(width - pad.left - pad.right, 0);
    const innerH = height - pad.top - pad.bottom;
    const band = data.length > 0 ? innerW / data.length : 0;
    const barW = Math.max(2, Math.min(band * 0.7, 48));
    const y = (value) => pad.top + innerH * (1 - value / top);
    const cx = (i) => pad.left + band * i + band / 2;
    const step = labelStep(data.length, innerW, 56);

    function onMove(event) {
        const box = event.currentTarget.getBoundingClientRect();
        const index = Math.floor((event.clientX - box.left - pad.left) / band);
        setHover(Math.min(data.length - 1, Math.max(0, index)));
    }

    return (
        <div ref={ref} className="relative w-full min-w-0">
            {total === 0 ? (
                <ChartEmpty height={height}>{emptyMessage}</ChartEmpty>
            ) : (
                width > 0 && (
                    <>
                        <svg className="block" width={width} height={height} role="img" aria-label={`Bar chart, ${total} in total across ${data.length} bars`}>
                            {ticks.map((tick) => (
                                <g key={tick}>
                                    <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={GRID_LINE} strokeWidth="1" />
                                    <text x={pad.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" className={AXIS_TEXT}>
                                        {tick}
                                    </text>
                                </g>
                            ))}

                            {data.map((d, i) => (
                                <g key={d.label + i}>
                                    <rect
                                        x={cx(i) - barW / 2}
                                        y={y(d.value)}
                                        width={barW}
                                        height={Math.max(y(0) - y(d.value), 0)}
                                        rx="2"
                                        fill={color}
                                        opacity={hover === null || hover === i ? 1 : 0.55}
                                    />
                                    {showValues && (
                                        <text x={cx(i)} y={y(d.value) - 5} textAnchor="middle" fontSize="11" className={AXIS_TEXT}>
                                            {d.value}
                                        </text>
                                    )}
                                    {i % step === 0 && (
                                        <text x={cx(i)} y={height - 6} textAnchor="middle" fontSize="11" className={AXIS_TEXT}>
                                            {d.label}
                                        </text>
                                    )}
                                </g>
                            ))}

                            <rect
                                x={pad.left}
                                y={0}
                                width={innerW}
                                height={height - pad.bottom}
                                fill="transparent"
                                style={{ touchAction: 'pan-y' }}
                                onPointerMove={onMove}
                                onPointerDown={onMove}
                                onPointerLeave={() => setHover(null)}
                            />
                        </svg>

                        {hover !== null && (
                            <Tooltip x={cx(hover)} width={width}>
                                <div className="font-medium">{data[hover].label}</div>
                                <div>
                                    {data[hover].value.toLocaleString()} {unit}
                                </div>
                            </Tooltip>
                        )}
                    </>
                )
            )}
        </div>
    );
}

/**
 * Horizontal bars with the label on the left and the number on the right.
 * Plain HTML, so long names wrap or truncate like normal text.
 *
 * data: [{ label, value, color? }]
 */
export function HBarChart({ data, color = CHART_COLORS.indigo, emptyMessage = 'Nothing to show yet.' }) {
    const max = Math.max(0, ...data.map((d) => d.value));

    if (max === 0) return <ChartEmpty>{emptyMessage}</ChartEmpty>;

    return (
        <ul className="space-y-3">
            {data.map((d) => (
                <li key={d.label}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate">{d.label}</span>
                        <span className="shrink-0 tabular-nums text-gray-500">{d.value.toLocaleString()}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                            className="h-full rounded-full"
                            style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color ?? color }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/**
 * A ring split into slices, with the total in the middle and a legend below.
 *
 * data: [{ label, value, color }]. Slices with 0 are left out of the ring but stay in the legend.
 */
export function DonutChart({ data, size = 140, centerLabel = 'total', emptyMessage = 'Nothing to show yet.' }) {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) return <ChartEmpty>{emptyMessage}</ChartEmpty>;

    const stroke = 22;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                    role="img"
                    aria-label={`Doughnut chart: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}
                >
                    <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                        {data
                            .filter((d) => d.value > 0)
                            .map((d) => {
                                const length = (d.value / total) * circumference;
                                const slice = (
                                    <circle
                                        key={d.label}
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        fill="none"
                                        stroke={d.color}
                                        strokeWidth={stroke}
                                        strokeDasharray={`${length} ${circumference - length}`}
                                        strokeDashoffset={-offset}
                                    >
                                        <title>{`${d.label}: ${d.value}`}</title>
                                    </circle>
                                );
                                offset += length;
                                return slice;
                            })}
                    </g>
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold leading-none">{total.toLocaleString()}</span>
                    <span className="mt-1 text-xs text-gray-500">{centerLabel}</span>
                </div>
            </div>

            <ul className="w-full space-y-1.5 text-sm">
                {data.map((d) => (
                    <li key={d.label} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            {d.label}
                        </span>
                        <span className="tabular-nums text-gray-500">
                            {d.value.toLocaleString()} · {Math.round((d.value / total) * 100)}%
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

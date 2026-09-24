import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import QuoteForm from '@/Components/QuoteForm';
import RequestCard from '@/Components/RequestCard';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { parseDuration } from '@/lib/durations';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const CARD = 'rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';
const PANEL = `${CARD} p-6`;

const BUTTON =
    'rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700';

function PricePill({ price }) {
    return (
        <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
            {price}
        </span>
    );
}

// What a technician said they would do: price, time and their note.
function QuoteBody({ quote }) {
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                <PricePill price={quote.price} />
                {quote.estimated_time && (
                    <span className="text-sm text-gray-500">Takes about {quote.estimated_time}</span>
                )}
                {quote.accepted && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                        Chosen
                    </span>
                )}
            </div>
            {quote.message && <p className="whitespace-pre-line break-words text-sm">{quote.message}</p>}
        </div>
    );
}

// One quote in the customer's list, with what they can do about it.
function QuoteItem({ quote, open }) {
    const technician = quote.technician;

    function message() {
        router.post(route('conversations.start', technician.id));
    }

    function choose() {
        if (confirm(`Choose ${technician.name}? The request will close to new quotes.`)) {
            router.post(route('quotes.accept', quote.id), {}, { preserveScroll: true });
        }
    }

    return (
        <li
            className={`space-y-3 rounded-lg border p-4 ${
                quote.accepted
                    ? 'border-green-400 bg-green-50/40 dark:border-green-700 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700'
            }`}
        >
            <div className="flex items-center justify-between gap-3">
                <Link href={route('technicians.show', technician.id)} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                    <Avatar user={technician} size="md" />
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{technician.name}</p>
                        <p className="truncate text-sm text-gray-500">
                            {technician.city && <>{technician.city} · </>}⭐ {technician.rating_avg ?? '—'} (
                            {technician.rating_count})
                        </p>
                    </div>
                </Link>
                <span className="shrink-0 text-xs text-gray-500">{relativeTime(quote.created_at)}</span>
            </div>

            <QuoteBody quote={quote} />

            <div className="flex flex-wrap gap-2">
                <button type="button" onClick={message} className={BUTTON}>
                    Message
                </button>
                {open && (
                    <button
                        type="button"
                        onClick={choose}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                        Choose this technician
                    </button>
                )}
            </div>
        </li>
    );
}

// The technician's own quote, or the form to send one.
function MyQuote({ serviceRequest, quote, canQuote, limits }) {
    const [editing, setEditing] = useState(false);

    function withdraw() {
        if (confirm('Withdraw your quote?')) {
            router.delete(route('requests.quote.destroy', serviceRequest.id), { preserveScroll: true });
        }
    }

    if (!quote && !canQuote) {
        return serviceRequest.status === 'closed' ? (
            <p className="text-sm text-gray-500">This request is closed, so it no longer takes quotes.</p>
        ) : null;
    }

    return (
        <section aria-label="Your quote" className={PANEL}>
            <h4 className="font-semibold">{quote ? 'Your quote' : 'Send a quote'}</h4>
            <p className="mb-3 mt-0.5 text-xs text-gray-500">
                Quotes are private to the customer and the technician who wrote them.
            </p>

            {quote && !editing ? (
                <div className="space-y-3">
                    <QuoteBody quote={quote} />
                    {!quote.accepted && canQuote && (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setEditing(true)} className={BUTTON}>
                                Edit
                            </button>
                            <button type="button" onClick={withdraw} className={BUTTON}>
                                Withdraw
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <QuoteForm
                    requestId={serviceRequest.id}
                    quote={quote}
                    limits={limits}
                    onDone={() => setEditing(false)}
                    onCancel={quote ? () => setEditing(false) : undefined}
                />
            )}
        </section>
    );
}

// The ways the customer can order the quotes they got. Price and time are kept
// as the text the technician wrote ("80 TND", "2 days"), so they are compared by
// the number in them; a quote without one goes last.
const QUOTE_SORTS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'price', label: 'Lowest price' },
    { value: 'time', label: 'Fastest' },
    { value: 'rating', label: 'Best rated' },
];

const HOURS_PER_UNIT = { hours: 1, days: 24, weeks: 24 * 7, months: 24 * 30 };

function firstNumber(text) {
    const match = String(text ?? '').match(/\d+(?:[.,]\d+)?/);

    return match ? parseFloat(match[0].replace(',', '.')) : Infinity;
}

function hoursOf(text) {
    if (!text) return Infinity;

    const { amount, unit } = parseDuration(text);

    return firstNumber(amount) * (HOURS_PER_UNIT[unit] ?? 1);
}

const QUOTE_ORDER = {
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    price: (a, b) => firstNumber(a.price) - firstNumber(b.price),
    time: (a, b) => hoursOf(a.estimated_time) - hoursOf(b.estimated_time),
    rating: (a, b) =>
        (b.technician.rating_avg ?? -1) - (a.technician.rating_avg ?? -1) ||
        (b.technician.rating_count ?? 0) - (a.technician.rating_count ?? 0),
};

// The customer's list of quotes, with a search over the technician's name and
// what they wrote, and a choice of order. Nothing to sift through with no quotes yet.
function QuotesPanel({ quotes, isOpen }) {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('newest');

    const term = search.trim().toLowerCase();
    const shown = quotes
        .filter(
            (quote) =>
                term === '' ||
                `${quote.technician.name} ${quote.message ?? ''} ${quote.price} ${quote.estimated_time ?? ''}`
                    .toLowerCase()
                    .includes(term),
        )
        // Array.sort is stable, so quotes that tie (or are all "Infinity") keep their newest-first order.
        .sort((a, b) => QUOTE_ORDER.newest(a, b))
        .sort(QUOTE_ORDER[sort]);

    return (
        <section aria-label="Quotes" className={PANEL}>
            <div className="mb-4 flex items-center gap-2">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Quotes</h2>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                    {quotes.length}
                </span>
            </div>

            {quotes.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                    <div className="relative min-w-0 flex-1 basis-40">
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="2"
                            stroke="currentColor"
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                        </svg>
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search quotes"
                            aria-label="Search quotes"
                            className="w-full rounded-md border-gray-300 py-1.5 pl-9 pr-3 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        />
                    </div>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label="Order quotes by"
                        className="shrink-0 rounded-md border-gray-300 py-1.5 pe-8 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                        {QUOTE_SORTS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {quotes.length === 0 && (
                <p className="text-sm text-gray-500">
                    {isOpen
                        ? 'No quotes yet. Technicians can see your request and will send you their price.'
                        : 'Nobody sent a quote.'}
                </p>
            )}

            {quotes.length > 0 && shown.length === 0 && (
                <p className="text-sm text-gray-500">No quotes match your search.</p>
            )}

            <ul className="space-y-3">
                {shown.map((quote) => (
                    <QuoteItem key={quote.id} quote={quote} open={isOpen} />
                ))}
            </ul>
        </section>
    );
}

// One repair request on its own page: where a shared link lands. The request is
// the same card as in the feed (in full, not clamped) on the left, and its quotes
// on the right (below it on a small screen). Someone with nothing to do with the
// quotes gets the request alone, centred.
export default function Show({ serviceRequest, isOwner, quotes, myQuote, canQuote, limits }) {
    const { auth, errors } = usePage().props;
    const isOpen = serviceRequest.status === 'open';
    const poster = serviceRequest.customer;
    const isTechnician = auth.user.role === 'technician' && !isOwner;
    const hasQuotesColumn = isOwner || isTechnician;

    function setStatus(action) {
        router.post(route(action, serviceRequest.id), {}, { preserveScroll: true });
    }

    function remove() {
        if (confirm('Delete this request and its quotes? This cannot be undone.')) {
            router.delete(route('requests.destroy', serviceRequest.id));
        }
    }

    return (
        <AuthenticatedLayout>
            <Head title="Repair request" />

            <div className={`mx-auto w-full px-4 py-8 sm:px-6 ${hasQuotesColumn ? 'max-w-6xl' : 'max-w-3xl'}`}>
                <Link href={route('feed.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← Back to the feed
                </Link>

                <div
                    className={`mt-4 grid gap-6 ${
                        hasQuotesColumn ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start' : ''
                    }`}
                >
                    <RequestCard
                        request={serviceRequest}
                        scope={isOwner ? 'mine' : 'all'}
                        detail
                        authorHref={poster.role === 'customer' ? route('customers.show', poster.id) : null}
                        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10"
                        actions={
                            isOwner ? (
                                <>
                                    <Link href={route('requests.edit', serviceRequest.id)} className={BUTTON}>
                                        Edit
                                    </Link>
                                    {isOpen ? (
                                        <button type="button" onClick={() => setStatus('requests.close')} className={BUTTON}>
                                            Close request
                                        </button>
                                    ) : (
                                        <button type="button" onClick={() => setStatus('requests.reopen')} className={BUTTON}>
                                            Reopen
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={remove}
                                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                                    >
                                        Delete
                                    </button>
                                    <InputError message={errors?.status} className="w-full" />
                                </>
                            ) : null
                        }
                    />

                    {hasQuotesColumn && (
                        <div className="min-w-0 space-y-6 lg:sticky lg:top-[5.0625rem] lg:max-h-[calc(100vh-6.0625rem)] lg:overflow-y-auto">
                            {isOwner && <QuotesPanel quotes={quotes} isOpen={isOpen} />}

                            {isTechnician && (
                                <MyQuote serviceRequest={serviceRequest} quote={myQuote} canQuote={canQuote} limits={limits} />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

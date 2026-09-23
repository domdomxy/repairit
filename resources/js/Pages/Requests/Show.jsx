import Avatar from '@/Components/Avatar';
import { PinIcon, WrenchIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import PostMedia from '@/Components/PostMedia';
import { Banner } from '@/Components/ProfileParts';
import QuoteForm from '@/Components/QuoteForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, relativeTime } from '@/lib/dates';
import { linkify, POST_LINK_CLASS } from '@/lib/linkify';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';
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
            <h4 className="mb-3 font-semibold">{quote ? 'Your quote' : 'Send a quote'}</h4>

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

// A small label over a value: one fact of the request.
function Detail({ label, children }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-gray-800 dark:text-gray-100">{children}</dd>
        </div>
    );
}

// One repair request on its own page: where a shared link lands. The request
// and its quotes are on the left; on the right, who posted it (below it on a
// small screen).
export default function Show({ serviceRequest, isOwner, quotes, myQuote, canQuote, limits }) {
    const { auth, errors } = usePage().props;
    const isOpen = serviceRequest.status === 'open';
    const poster = serviceRequest.customer;
    const isTechnician = auth.user.role === 'technician' && !isOwner;
    const posterName = isOwner ? 'You' : poster.name;
    const quoteCount = `${serviceRequest.quotes_count} quote${serviceRequest.quotes_count === 1 ? '' : 's'}`;

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

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <Link href={route('feed.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← Back to the feed
                </Link>

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                    <div className="min-w-0 space-y-6">
                        <section className={`${CARD} space-y-6 p-6 sm:p-8`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                                        <WrenchIcon className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <h1 className="break-words text-xl font-semibold text-gray-900 dark:text-gray-100">
                                            Repair request
                                        </h1>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Posted {formatDate(serviceRequest.created_at)}
                                            <span className="lg:hidden">
                                                {' '}
                                                by <bdi>{posterName}</bdi>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                                        isOpen
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    }`}
                                >
                                    {isOpen ? 'Open' : 'Closed'}
                                </span>
                            </div>

                            {/* A request has no title: what the customer wrote is the post. */}
                            <p className="whitespace-pre-line break-words text-base leading-relaxed text-gray-800 dark:text-gray-200">
                                {linkify(serviceRequest.description, { linkClassName: POST_LINK_CLASS })}
                            </p>

                            {serviceRequest.categories.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {serviceRequest.categories.map((category) => (
                                        <span
                                            key={category.id}
                                            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                        >
                                            {category.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <PostMedia media={serviceRequest.media} />

                            {(serviceRequest.budget || serviceRequest.city) && (
                                <dl className="flex flex-wrap gap-x-10 gap-y-4 rounded-xl bg-gray-50 px-5 py-4 dark:bg-gray-900/40">
                                    {serviceRequest.budget && (
                                        <Detail label="Budget">
                                            <span className="text-indigo-700 dark:text-indigo-200">{serviceRequest.budget}</span>
                                        </Detail>
                                    )}
                                    {serviceRequest.city && (
                                        <Detail label="City">
                                            <span className="inline-flex items-center gap-1">
                                                <PinIcon className="h-4 w-4 text-gray-400" />
                                                <bdi>{serviceRequest.city}</bdi>
                                            </span>
                                        </Detail>
                                    )}
                                </dl>
                            )}

                            {isOwner && (
                                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5 dark:border-gray-700">
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
                                </div>
                            )}
                        </section>

                        {isOwner && (
                            <section aria-label="Quotes" className={PANEL}>
                                <div className="mb-4 flex items-center gap-2">
                                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">Quotes</h2>
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                        {quotes.length}
                                    </span>
                                </div>

                                {quotes.length === 0 && (
                                    <p className="text-sm text-gray-500">
                                        {isOpen
                                            ? 'No quotes yet. Technicians can see your request and will send you their price.'
                                            : 'Nobody sent a quote.'}
                                    </p>
                                )}

                                <ul className="space-y-3">
                                    {quotes.map((quote) => (
                                        <QuoteItem key={quote.id} quote={quote} open={isOpen} />
                                    ))}
                                </ul>
                            </section>
                        )}

                        {isTechnician && (
                            <MyQuote serviceRequest={serviceRequest} quote={myQuote} canQuote={canQuote} limits={limits} />
                        )}
                    </div>

                    <aside aria-label="Posted by" className={`${CARD} overflow-hidden lg:sticky lg:top-[5.5rem]`}>
                        <Banner />

                        <div className="px-6 pb-6">
                            <div className="relative -mt-10 w-fit">
                                <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                                    <Avatar user={poster} size="lg" />
                                </div>
                            </div>

                            <div className="mt-3">
                                {poster.role === 'customer' ? (
                                    <Link
                                        href={route('customers.show', poster.id)}
                                        className="break-words text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100"
                                    >
                                        {posterName}
                                    </Link>
                                ) : (
                                    <span className="break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
                                        {posterName}
                                    </span>
                                )}
                            </div>

                            <span className="mt-2 inline-block rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                                {poster.role}
                            </span>

                            {poster.role === 'customer' && (
                                <Link
                                    href={route('customers.show', poster.id)}
                                    className="mt-5 block rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    View profile
                                </Link>
                            )}

                            <p className="mt-5 border-t border-gray-100 pt-4 text-sm text-gray-500 dark:border-gray-700">
                                {isOwner ? (
                                    <>{quoteCount} so far.</>
                                ) : (
                                    <>
                                        {quoteCount} sent so far. Quotes are private to the customer and the technician who wrote
                                        them.
                                    </>
                                )}
                            </p>
                        </div>
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import PostMedia from '@/Components/PostMedia';
import QuoteForm from '@/Components/QuoteForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate, relativeTime } from '@/lib/dates';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

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
            className={`space-y-3 rounded-md border p-4 dark:border-gray-700 ${
                quote.accepted ? 'border-green-400 dark:border-green-700' : ''
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

export default function Show({ serviceRequest, isOwner, quotes, myQuote, canQuote, limits }) {
    const { auth, errors } = usePage().props;
    const isOpen = serviceRequest.status === 'open';
    const poster = serviceRequest.customer;
    const isTechnician = auth.user.role === 'technician' && !isOwner;

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

            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
                <Link
                    href={route(isOwner ? 'requests.mine' : 'requests.index')}
                    className="text-sm text-indigo-600 hover:underline"
                >
                    ← {isOwner ? 'My requests' : 'Open requests'}
                </Link>

                <section className={`${PANEL} space-y-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <h2 className="min-w-0 break-words text-xl font-semibold">Repair request</h2>
                        <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                                isOpen
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                        >
                            {isOpen ? 'Open' : 'Closed'}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-2">
                            <Avatar user={poster} size="xs" />
                            {poster.role === 'customer' ? (
                                <Link href={route('customers.show', poster.id)} className="hover:underline">
                                    {isOwner ? 'You' : poster.name}
                                </Link>
                            ) : (
                                <span>{isOwner ? 'You' : poster.name}</span>
                            )}
                        </span>
                        {serviceRequest.city && <span>{serviceRequest.city}</span>}
                        <span>Posted {formatDate(serviceRequest.created_at)}</span>
                        {serviceRequest.budget && (
                            <span className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                                Budget: {serviceRequest.budget}
                            </span>
                        )}
                    </div>

                    {serviceRequest.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {serviceRequest.categories.map((category) => (
                                <span
                                    key={category.id}
                                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                >
                                    {category.name}
                                </span>
                            ))}
                        </div>
                    )}

                    <p className="whitespace-pre-line break-words text-sm">{serviceRequest.description}</p>

                    <PostMedia media={serviceRequest.media} />

                    {isOwner && (
                        <div className="flex flex-wrap gap-2 border-t pt-4 dark:border-gray-700">
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
                        <h4 className="mb-3 font-semibold">Quotes ({quotes.length})</h4>

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

                {!isOwner && (
                    <p className="text-sm text-gray-500">
                        {serviceRequest.quotes_count} quote{serviceRequest.quotes_count === 1 ? '' : 's'} sent so far.
                        Quotes are private to the customer and the technician who wrote them.
                    </p>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

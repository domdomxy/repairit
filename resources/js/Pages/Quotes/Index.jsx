import Avatar from '@/Components/Avatar';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import QuoteForm from '@/Components/QuoteForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const TABS = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Waiting' },
    { value: 'chosen', label: 'Chosen' },
    { value: 'closed', label: 'Closed' },
];

const STATUS_BADGES = {
    pending: { label: 'Waiting for the customer', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
    chosen: { label: 'Chosen', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
    closed: { label: 'Closed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};

const BUTTON =
    'rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700';

// One quote the technician sent: who asked, for what, what they answered and
// what became of it. Waiting quotes can be edited; any quote the customer did
// not choose can be deleted (the card in the chat then says it is gone).
function QuoteItem({ quote, limits }) {
    const [editing, setEditing] = useState(false);
    const { request } = quote;
    const badge = STATUS_BADGES[quote.status];

    function remove() {
        if (!window.confirm('Delete this quote? The customer will see it as no longer available.')) return;

        router.delete(route('requests.quote.destroy', request.id), { preserveScroll: true });
    }

    return (
        <li className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <Avatar user={request.customer} size="sm" />
                    <div className="min-w-0">
                        <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
                            <span className="truncate font-semibold text-gray-800 dark:text-gray-200">{request.customer.name}</span>
                            {request.city && <span className="truncate text-gray-500 dark:text-gray-400">· {request.city}</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400" title={formatDateTime(quote.created_at)}>
                            Quote sent {relativeTime(quote.created_at)}
                        </p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${badge.className}`}>{badge.label}</span>
            </div>

            <Link
                href={route('requests.show', request.id)}
                className="block line-clamp-2 whitespace-pre-line break-words text-sm text-gray-600 hover:underline dark:text-gray-400"
            >
                {request.excerpt}
            </Link>

            <div className="space-y-2 rounded-md bg-gray-50 p-3 dark:bg-gray-900/40">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                        {quote.price}
                    </span>
                    {quote.estimated_time && (
                        <span className="text-sm text-gray-500">Takes about {quote.estimated_time}</span>
                    )}
                    {request.budget && <span className="ms-auto text-xs text-gray-500">Their budget: {request.budget}</span>}
                </div>
                {quote.message && <p className="whitespace-pre-line break-words text-sm">{quote.message}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
                <Link href={route('requests.show', request.id)} className={BUTTON}>
                    View request
                </Link>
                {quote.conversation_id && (
                    <Link href={route('conversations.show', quote.conversation_id)} className={BUTTON}>
                        Open chat
                    </Link>
                )}
                {quote.status === 'pending' && (
                    <button type="button" onClick={() => setEditing(true)} className={BUTTON}>
                        Edit
                    </button>
                )}
                {quote.status !== 'chosen' && (
                    <button
                        type="button"
                        onClick={remove}
                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                        Delete
                    </button>
                )}
            </div>

            {quote.status === 'pending' && (
                <Modal show={editing} onClose={() => setEditing(false)} maxWidth="lg">
                    <div className="space-y-4 p-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit your quote</h3>
                            <p className="mt-1 line-clamp-2 text-sm text-gray-500">{request.excerpt}</p>
                        </div>

                        <QuoteForm
                            requestId={request.id}
                            quote={quote}
                            limits={limits}
                            onDone={() => setEditing(false)}
                            onCancel={() => setEditing(false)}
                        />
                    </div>
                </Modal>
            )}
        </li>
    );
}

// "My quotes": every quote a technician sent, with what became of it.
export default function Index({ quotes, counts, status, quoteLimits }) {
    const { auth } = usePage().props;

    const tab = (active) =>
        `inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition ${
            active
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`;

    return (
        <AuthenticatedLayout>
            <Head title="My quotes" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        <div className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <div className="flex flex-wrap gap-2">
                                {TABS.map((item) => (
                                    <Link
                                        key={item.value}
                                        href={route('technician.quotes.index', item.value === 'all' ? {} : { status: item.value })}
                                        className={tab(status === item.value)}
                                    >
                                        {item.label}
                                        <span className="text-xs opacity-80">{counts[item.value]}</span>
                                    </Link>
                                ))}
                            </div>

                            <p className="text-sm text-gray-500">
                                The quotes you sent. A customer sees them in your chat and on their request.
                            </p>
                        </div>

                        {quotes.data.length === 0 && (
                            <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                                {status === 'all' ? (
                                    <>
                                        You have not sent a quote yet. Find a request in{' '}
                                        <Link
                                            href={route('feed.index', { filter: 'requests' })}
                                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                                        >
                                            the feed
                                        </Link>{' '}
                                        and send the customer your price.
                                    </>
                                ) : (
                                    'No quotes here.'
                                )}
                            </p>
                        )}

                        <ul className="space-y-3">
                            {quotes.data.map((quote) => (
                                <QuoteItem key={quote.id} quote={quote} limits={quoteLimits} />
                            ))}
                        </ul>

                        <Pagination links={quotes.links} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import Avatar from '@/Components/Avatar';
import { DocumentIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import QuoteForm from '@/Components/QuoteForm';
import SegmentedTabs from '@/Components/SegmentedTabs';
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
    pending: {
        label: 'Waiting for the customer',
        className: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        dot: 'bg-amber-500',
    },
    chosen: {
        label: 'Chosen',
        className: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        dot: 'bg-green-500',
    },
    closed: {
        label: 'Closed',
        className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
        dot: 'bg-gray-400',
    },
};

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';

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
        <li className={CARD}>
            <div className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Avatar user={request.customer} size="md" />
                        <div className="min-w-0">
                            <p className="flex min-w-0 items-baseline gap-1.5 text-sm">
                                <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                    {request.customer.name}
                                </span>
                                {request.city && (
                                    <span className="truncate text-gray-500 dark:text-gray-400">
                                        · <bdi>{request.city}</bdi>
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400" title={formatDateTime(quote.created_at)}>
                                Quote sent {relativeTime(quote.created_at)}
                            </p>
                        </div>
                    </div>
                    <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                        {badge.label}
                    </span>
                </div>

                <Link
                    href={route('requests.show', request.id)}
                    className="block rounded-lg bg-gray-50 px-4 py-3 transition hover:bg-gray-100 dark:bg-gray-900/40 dark:hover:bg-gray-900/70"
                >
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Their request
                    </span>
                    <span className="mt-1 line-clamp-2 block whitespace-pre-line break-words text-sm text-gray-700 dark:text-gray-300">
                        {request.excerpt}
                    </span>
                </Link>

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-900/10">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
                            Your quote
                        </span>
                        <span className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">{quote.price}</span>
                        {quote.estimated_time && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Takes about {quote.estimated_time}
                            </span>
                        )}
                        {request.budget && (
                            <span className="ms-auto text-xs text-gray-500 dark:text-gray-400">
                                Their budget: {request.budget}
                            </span>
                        )}
                    </div>
                    {quote.message && (
                        <p className="mt-2 whitespace-pre-line break-words text-sm text-gray-700 dark:text-gray-300">
                            {quote.message}
                        </p>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-700">
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
                        className="ms-auto rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
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

    const tabs = TABS.map((item) => ({
        ...item,
        count: counts[item.value],
        href: route('technician.quotes.index', item.value === 'all' ? {} : { status: item.value }),
    }));

    return (
        <AuthenticatedLayout>
            <Head title="My quotes" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        <header className={`${CARD} flex flex-wrap items-center justify-between gap-4 px-6 py-5`}>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My quotes</h1>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                    The quotes you sent. A customer sees them in your chat and on their request.
                                </p>
                            </div>

                            <SegmentedTabs label="Filter quotes" tabs={tabs} value={status} />
                        </header>

                        {quotes.data.length === 0 && (
                            <div className={`${CARD} px-6 py-14 text-center`}>
                                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                                    <DocumentIcon className="h-6 w-6" />
                                </span>
                                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
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
                            </div>
                        )}

                        <ul className="space-y-4">
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

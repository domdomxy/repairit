import Modal from '@/Components/Modal';
import QuoteForm from '@/Components/QuoteForm';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

const MENU_ITEM =
    'block w-full px-4 py-2 text-start text-sm text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800';

// A quote sent in the chat, as a card that follows the quote: the technician who
// wrote it can edit or delete it from the three dots at the top right, and both
// people see the change. Once the quote is deleted only its price is left.
// `onMessagesChange` swaps in the messages the server sends back after a change.
export default function SharedQuoteCard({ quote, isMine, onMessagesChange }) {
    const { quoteLimits } = usePage().props;
    const [editing, setEditing] = useState(false);

    if (quote.id === null) {
        return (
            <div className="w-72 max-w-full rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
                <p className="italic">This quote is no longer available</p>
                <p className="mt-1 truncate">{quote.price}</p>
            </div>
        );
    }

    // A quote the customer chose is final, and the request it belongs to must still exist.
    const canManage = isMine && !quote.accepted && Boolean(quoteLimits) && quote.request?.id;

    function refresh(page) {
        if (page?.props?.messages) onMessagesChange(page.props.messages);
    }

    function remove() {
        if (!window.confirm('Delete this quote? The customer will see it as no longer available.')) return;

        router.delete(route('requests.quote.destroy', quote.request.id), {
            preserveScroll: true,
            onSuccess: refresh,
        });
    }

    return (
        <div className="w-72 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
            <div className="flex items-start justify-between gap-2 px-3 pt-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Quote
                    {quote.accepted && ' · Chosen'}
                    {quote.edited && !quote.accepted && ' · Edited'}
                </p>

                {canManage && (
                    <Menu>
                        <MenuButton
                            aria-label="Quote options"
                            className="-mt-1 shrink-0 rounded-md px-1.5 text-lg leading-none text-gray-500 hover:bg-gray-100 data-[open]:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 dark:data-[open]:bg-gray-700"
                        >
                            ⋯
                        </MenuButton>

                        <MenuItems
                            anchor="bottom end"
                            className="z-50 w-40 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 [--anchor-gap:6px] focus:outline-none dark:bg-gray-700"
                        >
                            <MenuItem>
                                <button type="button" onClick={() => setEditing(true)} className={MENU_ITEM}>
                                    Edit quote
                                </button>
                            </MenuItem>
                            <MenuItem>
                                <button type="button" onClick={remove} className={`${MENU_ITEM} !text-red-600 dark:!text-red-400`}>
                                    Delete quote
                                </button>
                            </MenuItem>
                        </MenuItems>
                    </Menu>
                )}
            </div>

            <div className="space-y-2 p-3 pt-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                        {quote.price}
                    </span>
                    {quote.estimated_time && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">Takes about {quote.estimated_time}</span>
                    )}
                </div>

                {quote.message && <p className="whitespace-pre-line break-words text-sm">{quote.message}</p>}

                {quote.request &&
                    (quote.request.url ? (
                        <Link href={quote.request.url} className="block text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                            <span className="line-clamp-2 text-gray-500 dark:text-gray-400">For: {quote.request.excerpt}</span>
                            View request →
                        </Link>
                    ) : (
                        <p className="line-clamp-2 text-xs italic text-gray-500 dark:text-gray-400">
                            For: {quote.request.excerpt} (no longer available)
                        </p>
                    ))}
            </div>

            {canManage && (
                <Modal show={editing} onClose={() => setEditing(false)} maxWidth="lg">
                    <div className="space-y-4 p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit your quote</h3>

                        <QuoteForm
                            requestId={quote.request.id}
                            quote={quote}
                            limits={quoteLimits}
                            onDone={(page) => {
                                setEditing(false);
                                refresh(page);
                            }}
                            onCancel={() => setEditing(false)}
                        />
                    </div>
                </Modal>
            )}
        </div>
    );
}

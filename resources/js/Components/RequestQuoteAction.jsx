import Modal from '@/Components/Modal';
import QuoteForm from '@/Components/QuoteForm';
import { usePage } from '@inertiajs/react';
import { useState } from 'react';

// The button at the bottom left of a request's card where a technician sends
// their quote (or changes the one they already sent). The form opens in a panel
// over the feed. Nothing is shown to anybody else: only technicians send quotes,
// never for their own request, and never once it is closed. `limits` comes from
// the server and is null for everyone who cannot send one.
export default function RequestQuoteAction({ request, limits }) {
    const { auth } = usePage().props;
    const [open, setOpen] = useState(false);

    if (!limits || auth.user.role !== 'technician' || auth.user.id === request.customer.id || request.status !== 'open') {
        return null;
    }

    const quote = request.my_quote ?? null;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={
                    quote
                        ? 'rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-200 dark:hover:bg-indigo-900/30'
                        : 'rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700'
                }
            >
                {quote ? 'Edit your quote' : 'Send a quote'}
            </button>

            <Modal show={open} onClose={() => setOpen(false)} maxWidth="lg">
                <div className="space-y-4 p-6">
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {quote ? 'Edit your quote' : 'Send a quote'}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{request.excerpt}</p>
                        <p className="mt-1 text-sm text-gray-500">
                            {request.customer.name} gets it in your chat, and you can change or delete it there too.
                        </p>
                    </div>

                    <QuoteForm
                        requestId={request.id}
                        quote={quote}
                        limits={limits}
                        onDone={() => setOpen(false)}
                        onCancel={() => setOpen(false)}
                    />
                </div>
            </Modal>
        </>
    );
}

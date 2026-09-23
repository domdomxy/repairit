import { Head, useForm, usePage } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import SupportThread from '@/Components/SupportThread';
import GuestLayout from '@/Layouts/GuestLayout';

export default function GuestShow({ ticket, thread, token }) {
    const { flash } = usePage().props;
    const { data, setData, post, processing, errors, reset } = useForm({ body: '' });
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        post(route('support.guest.reply', { ticket: ticket.id, token }), {
            preserveScroll: true,
            onSuccess: () => reset('body'),
        });
    }

    return (
        <GuestLayout>
            <Head title={`Ticket ${ticket.tracking_id}`} />

            <div className="mx-auto w-full max-w-xl space-y-6 px-6 py-10 sm:px-10">
                {flash?.success && (
                    <div
                        role="status"
                        className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        {flash.success}
                    </div>
                )}

                {/* This page's link is the guest's only way back in, so it stays
                    front and center rather than a one-time message that scrolls away. */}
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    <p className="font-medium">Bookmark this page.</p>
                    <p className="mt-1">
                        Ticket <span className="font-mono font-semibold">{ticket.tracking_id}</span> has no
                        account attached, so we can't send you a notification here. This page's link
                        is how you check for replies — we'll email it to you too.
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold">{ticket.subject}</h2>
                        <p className="mt-1 text-xs text-gray-500">
                            {ticket.tracking_id} · {ticket.category_label}
                        </p>
                    </div>
                    <SupportStatusBadge status={ticket.status} />
                </div>

                <SupportThread thread={thread} viewerIsStaff={false} />

                {closed ? (
                    <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                        This ticket is closed. Open a new one from the support page if you still need help.
                    </p>
                ) : (
                    <form onSubmit={submit} className="space-y-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                        <label htmlFor="reply" className="block text-sm font-medium">
                            {ticket.status === 'resolved' ? 'Not solved? Reply to reopen it' : 'Reply'}
                        </label>
                        <textarea
                            id="reply"
                            rows={4}
                            maxLength={5000}
                            value={data.body}
                            onChange={(e) => setData('body', e.target.value)}
                            className="block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                        <InputError message={errors.body} />
                        <button
                            type="submit"
                            disabled={processing || !data.body.trim()}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Send reply
                        </button>
                    </form>
                )}
            </div>
        </GuestLayout>
    );
}

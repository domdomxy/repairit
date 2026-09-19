import { Head, Link, router, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import SupportStatusBadge from '@/Components/SupportStatusBadge';
import SupportThread from '@/Components/SupportThread';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Show({ ticket, thread }) {
    const { data, setData, post, processing, errors, reset } = useForm({ body: '' });
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        post(route('support.reply', ticket.id), {
            preserveScroll: true,
            onSuccess: () => reset('body'),
        });
    }

    function close() {
        if (window.confirm('Close this ticket? You will not be able to reply to it afterwards.')) {
            router.post(route('support.close', ticket.id), {}, { preserveScroll: true });
        }
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold">{ticket.subject}</h2>
                        <p className="mt-1 text-xs text-gray-500">
                            {ticket.tracking_id} · {ticket.category_label}
                        </p>
                    </div>
                    <SupportStatusBadge status={ticket.status} />
                </div>
            }
        >
            <Head title={`Ticket ${ticket.tracking_id}`} />

            <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
                <Link href={route('support.index')} className="text-sm text-indigo-600 hover:underline">
                    All tickets
                </Link>

                <SupportThread thread={thread} viewerIsStaff={false} />

                {closed ? (
                    <p className="rounded-lg bg-white p-4 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                        This ticket is closed.{' '}
                        <Link href={route('support.create')} className="text-indigo-600 hover:underline">
                            Open a new ticket
                        </Link>{' '}
                        if you still need help.
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
                        <div className="flex items-center justify-between">
                            <button
                                type="submit"
                                disabled={processing || !data.body.trim()}
                                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                            >
                                Send reply
                            </button>
                            <button type="button" onClick={close} className="text-sm text-gray-500 hover:underline">
                                Close ticket
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

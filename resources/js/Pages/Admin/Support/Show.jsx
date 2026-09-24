import { Head, router, useForm } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import TicketAttachments from '@/Components/TicketAttachments';
import TicketConversation from '@/Components/TicketConversation';
import AdminLayout from '@/Layouts/AdminLayout';
import { statusLabels } from '@/lib/support';
import useSupportTicketLive from '@/lib/useSupportTicketLive';

export default function Show({ ticket, thread, first_unread_id }) {
    const { otherTyping, notifyTyping } = useSupportTicketLive({ ticketId: ticket.id, viewerIsStaff: true });
    // '' means "leave the status to the server" (an untouched ticket becomes in progress).
    const form = useForm({ body: '', status: '' });
    const { data, setData, post, reset } = form;
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        post(route('admin.support.reply', ticket.id), {
            preserveScroll: true,
            onSuccess: () => reset('body', 'status'),
        });
    }

    function setStatus(status) {
        router.post(route('admin.support.status', ticket.id), { status }, { preserveScroll: true });
    }

    return (
        <AdminLayout>
            <Head title={`Ticket ${ticket.tracking_id}`} />

            {/* From lg up this fills the screen below the top bar (65px, as in AdminLayout) and nothing
                else scrolls: the messages do, inside the card. The height is set here, not with h-full,
                because AdminLayout's flex-1 overrides its own height and leaves h-full nothing to resolve against. */}
            <div className="p-4 lg:h-[calc(100dvh-65px)] lg:p-6">
                <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)]">
                    <TicketConversation
                        ticket={ticket}
                        thread={thread}
                        viewerIsStaff
                        firstUnreadId={first_unread_id}
                        typing={otherTyping}
                        typingAuthor={ticket.user}
                        backHref={route('admin.support.index')}
                        notice={closed ? 'This ticket is closed. Reopen it to reply.' : null}
                        form={form}
                        onSubmit={submit}
                        onTyping={notifyTyping}
                        placeholder={`Reply to ${ticket.user.name}...`}
                        composerExtra={
                            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <label htmlFor="status">Then set status to</label>
                                <select
                                    id="status"
                                    value={data.status}
                                    onChange={(e) => setData('status', e.target.value)}
                                    className="rounded-md border-gray-300 py-1 pe-8 ps-2 text-xs dark:border-gray-700 dark:bg-gray-900"
                                >
                                    <option value="">Automatic</option>
                                    {Object.entries(statusLabels).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        }
                    />

                    <aside className="min-h-0 space-y-4 lg:overflow-y-auto">
                        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">Requester</h3>
                            <div className="mt-2 flex items-center gap-3">
                                <Avatar user={ticket.user} size="md" />
                                <div className="min-w-0">
                                    <p className="font-medium">{ticket.user.name}</p>
                                    <p className="truncate text-sm text-gray-500">{ticket.user.email}</p>
                                </div>
                            </div>
                            <p className="mt-1 text-xs capitalize text-gray-500">
                                {ticket.user.is_guest ? (
                                    'Guest — no account'
                                ) : (
                                    <>
                                        {ticket.user.role}
                                        {ticket.user.suspended && <span className="ms-2 text-red-600">Suspended</span>}
                                    </>
                                )}
                            </p>
                        </section>

                        <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <h3 className="text-xs font-semibold uppercase text-gray-500">Status</h3>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.entries(statusLabels)
                                    .filter(([value]) => value !== ticket.status)
                                    .map(([value, label]) => (
                                        <button
                                            key={value}
                                            onClick={() => setStatus(value)}
                                            className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                                        >
                                            {value === 'open' && closed ? 'Reopen' : `Mark ${label.toLowerCase()}`}
                                        </button>
                                    ))}
                            </div>
                        </section>

                        <TicketAttachments thread={thread} admin />
                    </aside>
                </div>
            </div>
        </AdminLayout>
    );
}

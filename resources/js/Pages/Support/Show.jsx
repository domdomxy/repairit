import { Head, Link, router, useForm } from '@inertiajs/react';
import TicketAttachments from '@/Components/TicketAttachments';
import TicketConversation from '@/Components/TicketConversation';
import { TicketDetails } from '@/Components/SupportUI';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { SUPPORT_TEAM } from '@/lib/support';
import useSupportTicketLive from '@/lib/useSupportTicketLive';

export default function Show({ ticket, thread, first_unread_id, attachmentLimits }) {
    const { otherTyping, notifyTyping } = useSupportTicketLive({ ticketId: ticket.id, viewerIsStaff: false });
    const form = useForm({ body: '', attachments: [] });
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        form.post(route('support.reply', ticket.id), {
            preserveScroll: true,
            onSuccess: () => form.reset('body', 'attachments'),
        });
    }

    function close() {
        if (window.confirm('Close this ticket? You will not be able to reply to it afterwards.')) {
            router.post(route('support.close', ticket.id), {}, { preserveScroll: true });
        }
    }

    return (
        <AuthenticatedLayout>
            <Head title={`Ticket ${ticket.tracking_id}`} />

            {/* From lg up the page fills the screen below the top bar and doesn't scroll: the messages do, inside the card. */}
            <div className="mx-auto w-full max-w-[96rem] p-4 sm:px-6 lg:h-[calc(100dvh-4rem)] lg:px-8">
                <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_24rem]">
                    <TicketConversation
                        ticket={ticket}
                        thread={thread}
                        viewerIsStaff={false}
                        firstUnreadId={first_unread_id}
                        typing={otherTyping}
                        typingAuthor={SUPPORT_TEAM}
                        backHref={route('support.index')}
                        headerActions={
                            closed ? null : (
                                <button
                                    type="button"
                                    onClick={close}
                                    className="text-sm text-gray-500 hover:underline dark:text-gray-400"
                                >
                                    Close ticket
                                </button>
                            )
                        }
                        notice={
                            closed ? (
                                <>
                                    This ticket is closed.{' '}
                                    <Link
                                        href={route('support.create')}
                                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                    >
                                        Open a new ticket
                                    </Link>{' '}
                                    if you still need help.
                                </>
                            ) : null
                        }
                        form={form}
                        onSubmit={submit}
                        onTyping={notifyTyping}
                        attachmentLimits={attachmentLimits}
                        placeholder={ticket.status === 'resolved' ? 'Not solved? Reply to reopen it...' : 'Type a message...'}
                    />

                    <aside className="min-h-0 space-y-6 lg:overflow-y-auto">
                        <TicketDetails ticket={ticket} />
                        <TicketAttachments thread={thread} />
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

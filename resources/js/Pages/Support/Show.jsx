import { Head, Link, router, useForm } from '@inertiajs/react';
import SupportThread from '@/Components/SupportThread';
import { ClosedNotice, ReplyBox, TicketDetails, TicketHeader, WITH_SIDE } from '@/Components/SupportUI';
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

            <div className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6 lg:px-8">
                <Link
                    href={route('support.index')}
                    className="mb-4 inline-block text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                >
                    All tickets
                </Link>

                <TicketHeader ticket={ticket} />

                <div className={WITH_SIDE}>
                    <div className="min-w-0 space-y-6">
                        <SupportThread
                            thread={thread}
                            viewerIsStaff={false}
                            firstUnreadId={first_unread_id}
                            typing={otherTyping}
                            typingAuthor={SUPPORT_TEAM}
                        />

                        {closed ? (
                            <ClosedNotice>
                                This ticket is closed.{' '}
                                <Link
                                    href={route('support.create')}
                                    className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Open a new ticket
                                </Link>{' '}
                                if you still need help.
                            </ClosedNotice>
                        ) : (
                            <ReplyBox
                                ticket={ticket}
                                form={form}
                                onSubmit={submit}
                                attachmentLimits={attachmentLimits}
                                onTyping={notifyTyping}
                            >
                                <button
                                    type="button"
                                    onClick={close}
                                    className="text-sm text-gray-500 hover:underline dark:text-gray-400"
                                >
                                    Close ticket
                                </button>
                            </ReplyBox>
                        )}
                    </div>

                    <aside>
                        <TicketDetails ticket={ticket} />
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

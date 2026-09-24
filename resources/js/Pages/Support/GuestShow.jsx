import { Head, useForm, usePage } from '@inertiajs/react';
import TicketAttachments from '@/Components/TicketAttachments';
import TicketConversation from '@/Components/TicketConversation';
import { SideCard, TicketDetails, WITH_SIDE } from '@/Components/SupportUI';
import GuestLayout from '@/Layouts/GuestLayout';

export default function GuestShow({ ticket, thread, first_unread_id, token, attachmentLimits }) {
    const { flash } = usePage().props;
    const form = useForm({ body: '', attachments: [] });
    const closed = ticket.status === 'closed';

    function submit(e) {
        e.preventDefault();
        form.post(route('support.guest.reply', { ticket: ticket.id, token }), {
            preserveScroll: true,
            onSuccess: () => form.reset('body', 'attachments'),
        });
    }

    return (
        <GuestLayout wide>
            <Head title={`Ticket ${ticket.tracking_id}`} />

            <div className="mb-8 space-y-4">
                {flash?.success && (
                    <div
                        role="status"
                        className="rounded-2xl bg-green-50 px-5 py-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300"
                    >
                        {flash.success}
                    </div>
                )}

                {/* This page's link is the guest's only way back in, so it stays
                    front and center rather than a one-time message that scrolls away. */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                    <p className="font-medium">Bookmark this page.</p>
                    <p className="mt-1">
                        Ticket <span className="font-mono font-semibold">{ticket.tracking_id}</span> has no account
                        attached, so we can't send you a notification here. This page's link is how you check for
                        replies. We'll email it to you too.
                    </p>
                </div>
            </div>

            <div className={WITH_SIDE}>
                <TicketConversation
                    ticket={ticket}
                    thread={thread}
                    viewerIsStaff={false}
                    firstUnreadId={first_unread_id}
                    notice={closed ? 'This ticket is closed. Open a new one from the support page if you still need help.' : null}
                    form={form}
                    onSubmit={submit}
                    attachmentLimits={attachmentLimits}
                    placeholder={ticket.status === 'resolved' ? 'Not solved? Reply to reopen it...' : 'Type a message...'}
                    className="h-[min(44rem,80dvh)] min-h-[28rem] shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10"
                />

                <aside className="space-y-6">
                    <TicketDetails ticket={ticket} />
                    <TicketAttachments thread={thread} />
                    <SideCard title="Waiting for a reply?">
                        <p>Come back to this page any time. New replies appear in the conversation.</p>
                    </SideCard>
                </aside>
            </div>
        </GuestLayout>
    );
}

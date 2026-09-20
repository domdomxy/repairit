import { usePage } from '@inertiajs/react';

/** The paper plane, seen from the side, used for messages throughout the app (outline, 24x24). */
export const MESSAGES_ICON_PATH = 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z';

/**
 * The messages panel's data: the newest conversations of the inbox and of the
 * requests, and how many conversations have something unread in each.
 *
 * The conversation open right now is being read, so it adds nothing to the
 * counts (messages that arrive in it live are only marked read on the next
 * visit); this is the same rule the conversation list on the messages page uses.
 */
export function useInbox() {
    const { inbox } = usePage().props;
    const recent = inbox?.recent ?? [];
    const requests = inbox?.requests ?? [];
    const activeId = route().current('conversations.show') ? Number(route().params.conversation) : null;

    const isActiveUnread = (list) => list.some((conversation) => conversation.id === activeId && conversation.unread_count > 0);
    const activeInRequests = isActiveUnread(requests) ? 1 : 0;
    const activeInInbox = isActiveUnread(recent) ? 1 : 0;

    const unreadRequests = Math.max(0, (inbox?.unread_requests ?? 0) - activeInRequests);
    const unreadTotal = Math.max(0, (inbox?.unread ?? 0) - activeInRequests - activeInInbox);

    return {
        recent,
        requests,
        activeId,
        unread: unreadTotal,
        unreadRequests,
        unreadInbox: Math.max(0, unreadTotal - unreadRequests),
    };
}

import { usePage } from '@inertiajs/react';

/** The paper plane, seen from the side, used for messages throughout the app (outline, 24x24). */
// An inbox tray outline, drawn in the same rounded, thin-stroke family as the
// notification bell so the two header icons read as a matched pair.
export const MESSAGES_ICON_PATH =
    'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-3.586a1 1 0 00-.707.293l-1.414 1.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 006.586 13H3';

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
    const hidden = inbox?.hidden ?? [];
    const activeId = route().current('conversations.show') ? Number(route().params.conversation) : null;

    const isActiveUnread = (list) => list.some((conversation) => conversation.id === activeId && conversation.unread_count > 0);
    const activeInRequests = isActiveUnread(requests) ? 1 : 0;
    const activeInInbox = isActiveUnread(recent) ? 1 : 0;
    const activeInHidden = isActiveUnread(hidden) ? 1 : 0;

    const unreadRequests = Math.max(0, (inbox?.unread_requests ?? 0) - activeInRequests);
    const unreadHidden = Math.max(0, (inbox?.unread_hidden ?? 0) - activeInHidden);
    const unreadTotal = Math.max(0, (inbox?.unread ?? 0) - activeInRequests - activeInInbox);

    return {
        recent,
        requests,
        hidden,
        activeId,
        unread: unreadTotal,
        unreadRequests,
        unreadHidden,
        unreadInbox: Math.max(0, unreadTotal - unreadRequests),
    };
}

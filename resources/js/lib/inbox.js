import { usePage } from '@inertiajs/react';

/** The paper plane, seen from the side, used for messages throughout the app (outline, 24x24). */
// An inbox tray outline, drawn in the same rounded, thin-stroke family as the
// notification bell so the two header icons read as a matched pair.
export const MESSAGES_ICON_PATH =
    'M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z';

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

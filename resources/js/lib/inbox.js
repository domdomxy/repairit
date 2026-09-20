import { usePage } from '@inertiajs/react';

/** The chat bubble used for messages throughout the app. */
export const CHAT_PATH =
    'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z';

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

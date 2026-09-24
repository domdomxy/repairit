import { router, usePage } from '@inertiajs/react';
import { useChannel, useEcho } from '@laravel/echo-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// How long the "typing" bubble stays after the last whisper, and how often
// one whisper is sent while typing (the same numbers the chat page uses).
const TYPING_VISIBLE_MS = 3000;
const TYPING_WHISPER_EVERY_MS = 2000;

/**
 * Keeps an open ticket page live, for someone signed in (the person who
 * asked for help, or an admin): a new message on the ticket fetches the
 * conversation again, and `otherTyping` says whether the other side is
 * typing a reply right now. Call `notifyTyping` from the reply box.
 *
 * Typing is a whisper on the ticket's private channel, not a database write:
 * it never touches the server and fades on its own if nothing follows. A
 * guest has no account to authorize with, so their page doesn't use this.
 */
export default function useSupportTicketLive({ ticketId, viewerIsStaff }) {
    const { auth } = usePage().props;
    const channelName = `support.ticket.${ticketId}`;
    const [otherTyping, setOtherTyping] = useState(false);
    const typingTimeout = useRef(null);
    const lastWhisper = useRef(0);

    useEcho(channelName, '.message.posted', (event) => {
        // What the other side just wrote is no longer "still typing".
        if (event.from_staff !== viewerIsStaff) setOtherTyping(false);

        // Just this person's own send: the page already got it back with the reply.
        if (event.user_id === auth.user.id) return;

        // Only the conversation and the status (and the bell, since opening the
        // ticket marks its notification read), so the reply box, and whatever
        // is half written in it, is left alone.
        router.reload({ only: ['thread', 'ticket', 'notifications'] });
    });

    const { channel } = useChannel(channelName);

    useEffect(() => {
        const ch = channel();
        if (!ch) return undefined;

        function onTyping(payload) {
            // Another admin on the same ticket typing is not "the other side".
            if (payload?.staff === viewerIsStaff) return;

            setOtherTyping(true);
            clearTimeout(typingTimeout.current);
            typingTimeout.current = setTimeout(() => setOtherTyping(false), TYPING_VISIBLE_MS);
        }

        ch.listenForWhisper('typing', onTyping);

        return () => {
            ch.stopListeningForWhisper('typing', onTyping);
            clearTimeout(typingTimeout.current);
        };
    }, [channel, viewerIsStaff]);

    // Throttled so holding a key down doesn't flood the socket.
    const notifyTyping = useCallback(() => {
        const now = Date.now();
        if (now - lastWhisper.current < TYPING_WHISPER_EVERY_MS) return;

        lastWhisper.current = now;
        channel()?.whisper('typing', { staff: viewerIsStaff });
    }, [channel, viewerIsStaff]);

    return { otherTyping, notifyTyping };
}

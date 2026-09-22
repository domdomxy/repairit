import { useChannel } from '@laravel/echo-react';
import { useEffect } from 'react';

// Renders nothing: it just keeps one row of a conversation list in sync with
// whether the other person is typing there right now, the same whisper the
// open chat listens for (see Show.jsx), without needing that chat open.
export default function ConversationTypingWatcher({ conversationId, onTyping }) {
    const { channel } = useChannel(`conversation.${conversationId}`);

    useEffect(() => {
        const ch = channel();
        if (!ch) return undefined;

        function handle() {
            onTyping(conversationId);
        }

        ch.listenForWhisper('typing', handle);

        return () => ch.stopListeningForWhisper('typing', handle);
    }, [channel, conversationId, onTyping]);

    return null;
}

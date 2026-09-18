import { useEffect, useRef, useState } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Show({ conversation, messages: initialMessages }) {
    const { auth } = usePage().props;
    const [messages, setMessages] = useState(initialMessages);
    const bottomRef = useRef(null);

    const otherParty =
        auth.user.id === conversation.customer_id
            ? conversation.technician
            : conversation.customer;

    // Live incoming messages
    useEcho(`conversation.${conversation.id}`, '.message.sent', (event) => {
        setMessages((current) => [...current, event]);
    });

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const { data, setData, post, processing, reset } = useForm({ body: '' });

    function submit(e) {
        e.preventDefault();
        if (!data.body.trim()) return;

        post(route('messages.store', conversation.id), {
            preserveScroll: true,
            onSuccess: () => reset('body'),
            // Optimistic local append; server broadcast will skip us via toOthers()
            onBefore: () => {
                setMessages((current) => [
                    ...current,
                    {
                        id: `local-${Date.now()}`,
                        sender_id: auth.user.id,
                        sender_name: auth.user.name,
                        body: data.body,
                        created_at: new Date().toISOString(),
                    },
                ]);
            },
        });
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">{otherParty.name}</h2>}>
            <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col h-[70vh]">
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {messages.map((message) => {
                        const isMine = message.sender_id === auth.user.id;
                        return (
                            <div
                                key={message.id}
                                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-xs px-4 py-2 rounded-lg ${
                                        isMine
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800'
                                    }`}
                                >
                                    <p className="text-sm">{message.body}</p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>

                <form onSubmit={submit} className="mt-4 flex gap-2">
                    <input
                        type="text"
                        value={data.body}
                        onChange={(e) => setData('body', e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 rounded-md border-gray-300 dark:bg-gray-800"
                    />
                    <button
                        type="submit"
                        disabled={processing}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
                    >
                        Send
                    </button>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
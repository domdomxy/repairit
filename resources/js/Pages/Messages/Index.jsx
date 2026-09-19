import { Link, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Index({ conversations }) {
    const { auth } = usePage().props;

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Messages</h2>}>
            <div className="max-w-3xl mx-auto py-8 px-4">
                {conversations.length === 0 && (
                    <p className="text-gray-500">No conversations yet.</p>
                )}

                <ul className="divide-y divide-gray-200 dark:divide-gray-700 border rounded-lg overflow-hidden">
                    {conversations.map((conversation) => {
                        const otherParty =
                            auth.user.id === conversation.customer_id
                                ? conversation.technician
                                : conversation.customer;

                        return (
                            <li key={conversation.id}>
                                <Link
                                    href={route('conversations.show', conversation.id)}
                                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                                >
                                    <span className="flex items-center gap-3">
                                        <Avatar user={otherParty} size="md" />
                                        <span className="font-medium">{otherParty.name}</span>
                                    </span>

                                    {conversation.unread_count > 0 && (
                                        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-semibold text-white bg-indigo-600 rounded-full">
                                            {conversation.unread_count}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </AuthenticatedLayout>
    );
}
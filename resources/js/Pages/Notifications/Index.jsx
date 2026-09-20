import { Head, router, usePage } from '@inertiajs/react';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDateTime } from '@/lib/dates';

export default function Index({ items }) {
    const unread = usePage().props.notifications?.unread ?? 0;

    return (
        <AuthenticatedLayout>
            <Head title="Notifications" />

            <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
                {unread > 0 && (
                    <div className="flex justify-end">
                        <button
                            onClick={() => router.post(route('notifications.read-all'), {}, { preserveScroll: true })}
                            className="text-sm text-indigo-600 hover:underline"
                        >
                            Mark all as read
                        </button>
                    </div>
                )}

                {items.data.length === 0 && (
                    <p className="rounded-lg bg-white p-8 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                        You have no notifications yet.
                    </p>
                )}

                <ul className="space-y-2">
                    {items.data.map((item) => (
                        <li key={item.id}>
                            <button
                                onClick={() => router.post(route('notifications.read', item.id))}
                                className={`block w-full rounded-lg p-4 text-start shadow transition hover:opacity-90 ${
                                    item.read_at
                                        ? 'bg-white dark:bg-gray-800'
                                        : 'border-s-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                }`}
                            >
                                <div className={`text-sm ${item.read_at ? '' : 'font-semibold'}`}>{item.title}</div>
                                {item.body && <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.body}</div>}
                                <div className="mt-1 text-xs text-gray-500">{formatDateTime(item.created_at)}</div>
                            </button>
                        </li>
                    ))}
                </ul>

                <Pagination links={items.links} />
            </div>
        </AuthenticatedLayout>
    );
}

import { Head } from '@inertiajs/react';
import Pagination from '@/Components/Pagination';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatDateTime } from '@/lib/dates';

export default function Index({ logs }) {
    return (
        <AdminLayout>
            <Head title="Activity log" />

            <div className="mx-auto max-w-5xl px-4 py-8">
                <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3">When</th>
                                <th className="px-4 py-3">Admin</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {logs.data.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                        Nothing has been logged yet.
                                    </td>
                                </tr>
                            )}

                            {logs.data.map((log) => (
                                <tr key={log.id}>
                                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                                        {formatDateTime(log.created_at)}
                                    </td>
                                    <td className="px-4 py-3">{log.admin ?? 'Deleted admin'}</td>
                                    <td className="px-4 py-3">
                                        <code className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-gray-700">
                                            {log.action}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3">{log.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={logs.links} />
            </div>
        </AdminLayout>
    );
}

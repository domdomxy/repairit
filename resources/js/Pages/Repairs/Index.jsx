import Avatar from '@/Components/Avatar';
import Pagination from '@/Components/Pagination';
import RepairStatusBadge from '@/Components/RepairStatusBadge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { relativeTime } from '@/lib/dates';
import { Head, Link } from '@inertiajs/react';

// The repairs a technician linked to your account: open one to see where it is.
export default function Index({ repairs }) {
    return (
        <AuthenticatedLayout>
            <Head title="My repairs" />

            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
                <section className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">My repairs</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        What you left with a technician, and where it is now. You can also open the link a technician
                        gave you.
                    </p>

                    <div className="mt-6">
                        {repairs.data.length === 0 && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Nothing yet. When a technician starts tracking something for you, it shows up here.
                            </p>
                        )}

                        <ul className="space-y-3">
                            {repairs.data.map((repair) => (
                                <li key={repair.code}>
                                    <Link
                                        href={route('repairs.show', repair.code)}
                                        className="flex items-center justify-between gap-4 rounded-md border p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/40"
                                    >
                                        <div className="flex min-w-0 items-center gap-3">
                                            <Avatar user={repair.technician} size="sm" />
                                            <div className="min-w-0">
                                                <p className="truncate font-medium">{repair.title}</p>
                                                <p className="mt-1 truncate text-xs text-gray-500">
                                                    {repair.technician.name} · updated {relativeTime(repair.updated_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <RepairStatusBadge status={repair.status} label={repair.status_label} />
                                    </Link>
                                </li>
                            ))}
                        </ul>

                        <Pagination links={repairs.links} />
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}

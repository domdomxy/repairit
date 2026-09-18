import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import Pagination from '@/Components/Pagination';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { formatDate } from '@/lib/dates';

const roleStyles = {
    admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    technician: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    customer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function Index({ users, filters }) {
    const [q, setQ] = useState(filters.q ?? '');
    const [role, setRole] = useState(filters.role ?? '');
    const [status, setStatus] = useState(filters.status ?? '');

    function apply(next = {}) {
        const values = { q, role, status, ...next };

        // Drop empty values so the URL stays clean.
        const query = Object.fromEntries(Object.entries(values).filter(([, value]) => value));

        router.get(route('admin.users.index'), query, { preserveState: true, replace: true });
    }

    function act(method, routeName, user, message) {
        if (message && !window.confirm(message)) {
            return;
        }

        router[method](route(routeName, user.id), {}, { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Users</h2>}>
            <Head title="Users" />

            <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        apply();
                    }}
                    className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow dark:bg-gray-800"
                >
                    <div className="min-w-[14rem] flex-1">
                        <label htmlFor="q" className="block text-xs font-medium text-gray-500">
                            Search name or email
                        </label>
                        <input
                            id="q"
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="mt-1 w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                    </div>

                    <div>
                        <label htmlFor="role" className="block text-xs font-medium text-gray-500">
                            Role
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value);
                                apply({ role: e.target.value });
                            }}
                            className="mt-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        >
                            <option value="">All roles</option>
                            <option value="customer">Customers</option>
                            <option value="technician">Technicians</option>
                            <option value="admin">Admins</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="status" className="block text-xs font-medium text-gray-500">
                            Status
                        </label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                apply({ status: e.target.value });
                            }}
                            className="mt-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        >
                            <option value="">Any status</option>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                        Search
                    </button>
                </form>

                <div className="overflow-x-auto rounded-lg bg-white shadow dark:bg-gray-800">
                    <table className="min-w-full text-left text-sm">
                        <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-700">
                            <tr>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Joined</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {users.data.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No users match these filters.
                                    </td>
                                </tr>
                            )}

                            {users.data.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-medium">{user.name}</div>
                                        <div className="text-xs text-gray-500">{user.email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs capitalize ${roleStyles[user.role]}`}
                                        >
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.suspended_at ? (
                                            <span className="text-red-600">
                                                Suspended {formatDate(user.suspended_at)}
                                            </span>
                                        ) : (
                                            <span className="text-green-600">Active</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{formatDate(user.created_at)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {user.role === 'admin' ? (
                                            <span className="text-xs text-gray-400">Protected</span>
                                        ) : (
                                            <div className="flex justify-end gap-3">
                                                {user.suspended_at ? (
                                                    <button
                                                        onClick={() => act('post', 'admin.users.unsuspend', user)}
                                                        className="text-indigo-600 hover:underline"
                                                    >
                                                        Restore
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() =>
                                                            act(
                                                                'post',
                                                                'admin.users.suspend',
                                                                user,
                                                                `Suspend ${user.name}? They will be signed out and hidden from search.`,
                                                            )
                                                        }
                                                        className="text-amber-600 hover:underline"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() =>
                                                        act(
                                                            'delete',
                                                            'admin.users.destroy',
                                                            user,
                                                            `Permanently delete ${user.name}? Their conversations and reviews are deleted too. This cannot be undone.`,
                                                        )
                                                    }
                                                    className="text-red-600 hover:underline"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Pagination links={users.links} />
            </div>
        </AuthenticatedLayout>
    );
}

import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/Components/InputError';
import AdminLayout from '@/Layouts/AdminLayout';

export default function Index({ categories }) {
    const create = useForm({ name: '' });
    const edit = useForm({ name: '' });
    const [editingId, setEditingId] = useState(null);

    function submitCreate(e) {
        e.preventDefault();
        create.post(route('admin.categories.store'), {
            preserveScroll: true,
            onSuccess: () => create.reset(),
        });
    }

    function startEdit(category) {
        edit.clearErrors();
        edit.setData('name', category.name);
        setEditingId(category.id);
    }

    function submitEdit(e, category) {
        e.preventDefault();
        edit.put(route('admin.categories.update', category.id), {
            preserveScroll: true,
            onSuccess: () => setEditingId(null),
        });
    }

    function remove(category) {
        const note =
            category.technician_count > 0
                ? `${category.technician_count} technician(s) currently list it and will lose this specialty. `
                : '';

        if (window.confirm(`Delete "${category.name}"? ${note}This cannot be undone.`)) {
            router.delete(route('admin.categories.destroy', category.id), { preserveScroll: true });
        }
    }

    return (
        <AdminLayout>
            <Head title="Categories" />

            <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
                <form onSubmit={submitCreate} className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                    <label htmlFor="new-category" className="block text-sm font-medium">
                        New category
                    </label>
                    <div className="mt-2 flex gap-3">
                        <input
                            id="new-category"
                            type="text"
                            value={create.data.name}
                            onChange={(e) => create.setData('name', e.target.value)}
                            placeholder="e.g. Roofing"
                            className="flex-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                        />
                        <button
                            type="submit"
                            disabled={create.processing}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>
                    <InputError message={create.errors.name} className="mt-2" />
                </form>

                <div className="rounded-lg bg-white shadow dark:bg-gray-800">
                    {categories.length === 0 && (
                        <p className="p-6 text-center text-sm text-gray-500">No categories yet.</p>
                    )}

                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {categories.map((category) => (
                            <li key={category.id} className="p-4">
                                {editingId === category.id ? (
                                    <form onSubmit={(e) => submitEdit(e, category)}>
                                        <div className="flex gap-3">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={edit.data.name}
                                                onChange={(e) => edit.setData('name', e.target.value)}
                                                className="flex-1 rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                                            />
                                            <button
                                                type="submit"
                                                disabled={edit.processing}
                                                className="rounded-md bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                                            >
                                                Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(null)}
                                                className="px-3 py-2 text-sm text-gray-500 hover:underline"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                        <InputError message={edit.errors.name} className="mt-2" />
                                    </form>
                                ) : (
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium">{category.name}</div>
                                            <div className="text-xs text-gray-500">
                                                {category.technician_count} technician
                                                {category.technician_count === 1 ? '' : 's'} · /{category.slug}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 text-sm">
                                            <button
                                                onClick={() => startEdit(category)}
                                                className="text-indigo-600 hover:underline"
                                            >
                                                Rename
                                            </button>
                                            <button
                                                onClick={() => remove(category)}
                                                className="text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </AdminLayout>
    );
}

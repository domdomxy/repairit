import { Head, Link, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Create({ categories }) {
    const { data, setData, post, processing, errors } = useForm({
        category: '',
        subject: '',
        body: '',
    });

    function submit(e) {
        e.preventDefault();
        post(route('support.store'));
    }

    const field = 'mt-1 block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900';

    return (
        <AuthenticatedLayout>
            <Head title="New support ticket" />

            <div className="mx-auto max-w-2xl px-4 py-8">
                <form onSubmit={submit} className="space-y-5 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium">
                            What is this about?
                        </label>
                        <select
                            id="category"
                            value={data.category}
                            onChange={(e) => setData('category', e.target.value)}
                            className={field}
                        >
                            <option value="">Choose a topic</option>
                            {Object.entries(categories).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <InputError message={errors.category} className="mt-1" />
                    </div>

                    <div>
                        <label htmlFor="subject" className="block text-sm font-medium">
                            Subject
                        </label>
                        <input
                            id="subject"
                            type="text"
                            maxLength={150}
                            value={data.subject}
                            onChange={(e) => setData('subject', e.target.value)}
                            className={field}
                        />
                        <InputError message={errors.subject} className="mt-1" />
                    </div>

                    <div>
                        <label htmlFor="body" className="block text-sm font-medium">
                            Tell us what happened
                        </label>
                        <textarea
                            id="body"
                            rows={7}
                            maxLength={5000}
                            value={data.body}
                            onChange={(e) => setData('body', e.target.value)}
                            className={field}
                        />
                        <InputError message={errors.body} className="mt-1" />
                        <p className="mt-1 text-xs text-gray-500">
                            When reporting a user, include their name and what they did.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Send ticket
                        </button>
                        <Link href={route('support.index')} className="text-sm text-gray-500 hover:underline">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

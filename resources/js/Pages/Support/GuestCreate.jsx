import { Head, Link, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';

// The support form for someone without an account. Since there's nowhere to
// notify them, we ask for a name and email up front and hand back a link
// (and a ticket ID) they have to hold onto themselves.
export default function GuestCreate({ categories }) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        category: '',
        subject: '',
        body: '',
    });

    function submit(e) {
        e.preventDefault();
        post(route('support.guest.store'));
    }

    const field = 'mt-1 block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900';

    return (
        <GuestLayout>
            <Head title="Get support" />

            <div className="mx-auto w-full max-w-md px-6 py-10 sm:px-10">
                <h1 className="font-display text-2xl font-semibold">Get support</h1>
                <p className="mt-1 text-sm text-gray-500">
                    No account needed. We'll give you a ticket ID and a link to this page —
                    since there's no account of yours to notify, that link is how you check for a reply.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium">
                                Your name
                            </label>
                            <input
                                id="name"
                                type="text"
                                maxLength={100}
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className={field}
                            />
                            <InputError message={errors.name} className="mt-1" />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium">
                                Your email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className={field}
                            />
                            <InputError message={errors.email} className="mt-1" />
                        </div>
                    </div>

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
                            rows={6}
                            maxLength={5000}
                            value={data.body}
                            onChange={(e) => setData('body', e.target.value)}
                            className={field}
                        />
                        <InputError message={errors.body} className="mt-1" />
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Send ticket
                        </button>
                        <Link href={route('support.guest.track')} className="text-sm text-gray-500 hover:underline">
                            Already have a ticket?
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}

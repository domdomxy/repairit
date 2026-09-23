import { Head, Link, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import GuestLayout from '@/Layouts/GuestLayout';

// A guest who lost their ticket link can get back in with the ticket ID they
// were given plus the email they opened it with — there's no password to reset.
export default function GuestTrack() {
    const { data, setData, post, processing, errors } = useForm({ tracking_id: '', email: '' });

    function submit(e) {
        e.preventDefault();
        post(route('support.guest.lookup'));
    }

    const field = 'mt-1 block w-full rounded-md border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900';

    return (
        <GuestLayout>
            <Head title="Find your ticket" />

            <div className="mx-auto w-full max-w-md px-6 py-10 sm:px-10">
                <h1 className="font-display text-2xl font-semibold">Find your ticket</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Enter the ticket ID you were given (it looks like SUP-XXXXXX) and the email
                    you used, and we'll take you straight to it.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-5">
                    <div>
                        <label htmlFor="tracking_id" className="block text-sm font-medium">
                            Ticket ID
                        </label>
                        <input
                            id="tracking_id"
                            type="text"
                            placeholder="SUP-XXXXXX"
                            value={data.tracking_id}
                            onChange={(e) => setData('tracking_id', e.target.value)}
                            className={field}
                        />
                        <InputError message={errors.tracking_id} className="mt-1" />
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium">
                            Email you used
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

                    <div className="flex items-center gap-4">
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                        >
                            Find ticket
                        </button>
                        <Link href={route('support.guest.create')} className="text-sm text-gray-500 hover:underline">
                            Open a new ticket instead
                        </Link>
                    </div>
                </form>
            </div>
        </GuestLayout>
    );
}

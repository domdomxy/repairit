import RequestForm from '@/Components/RequestForm';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

// Post a repair request, or edit one you posted.
export default function Form({ serviceRequest, categories, limits, defaultCity }) {
    const editing = serviceRequest !== null;

    const cancelHref = editing ? route('requests.show', serviceRequest.id) : route('feed.index');

    return (
        <AuthenticatedLayout>
            <Head title={editing ? 'Edit request' : 'Post a request'} />

            <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
                <div className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <header>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {editing ? 'Edit your request' : 'Post a repair request'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Describe what needs fixing. Technicians can see it and send you a quote. Your email and
                            phone number are never shown.
                        </p>
                    </header>

                    <RequestForm
                        serviceRequest={serviceRequest}
                        categories={categories}
                        limits={limits}
                        defaultCity={defaultCity}
                        cancelHref={cancelHref}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

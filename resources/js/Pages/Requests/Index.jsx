import Pagination from '@/Components/Pagination';
import ProfileSidebar from '@/Components/ProfileSidebar';
import RequestCard from '@/Components/RequestCard';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// Only send filters that are set, so the URL stays clean.
function buildParams(form) {
    return Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''));
}

// Repair requests: what customers need fixed. Two tabs over the same list:
// every open request (for technicians to answer) and the ones you posted.
export default function Index({ requests, categories, scope, filters }) {
    const { auth } = usePage().props;
    const listRoute = scope === 'mine' ? 'requests.mine' : 'requests.index';

    const [form, setForm] = useState({
        q: filters.q ?? '',
        category: filters.category ?? '',
        city: filters.city ?? '',
    });

    // Results follow the filters as they change, after a short pause. The
    // last-sent query is remembered so the first render never sends a request.
    const lastSent = useRef(JSON.stringify(buildParams(form)));

    useEffect(() => {
        const params = buildParams(form);
        const key = JSON.stringify(params);

        if (key === lastSent.current) return undefined;

        const timer = setTimeout(() => {
            lastSent.current = key;

            router.get(route(listRoute), params, { preserveState: true, preserveScroll: true, replace: true });
        }, 300);

        return () => clearTimeout(timer);
    }, [form, listRoute]);

    const tab = (active) =>
        `rounded-full px-4 py-1.5 text-sm transition ${
            active
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
        }`;

    const field = 'block w-full text-sm';

    return (
        <AuthenticatedLayout>
            <Head title="Repair requests" />

            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-4 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    <div className="min-w-0 flex-1 space-y-4">
                        <div className="space-y-4 rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex gap-2">
                                    <Link href={route('requests.index')} className={tab(scope === 'all')}>
                                        Open requests
                                    </Link>
                                    <Link href={route('requests.mine')} className={tab(scope === 'mine')}>
                                        My requests
                                    </Link>
                                </div>

                                <Link
                                    href={route('requests.create')}
                                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                                >
                                    Post a request
                                </Link>
                            </div>

                            <p className="text-sm text-gray-500">
                                {scope === 'mine'
                                    ? 'What you asked for. Open a request to compare the quotes you received.'
                                    : 'What customers need fixed. Open a request to send the customer your price.'}
                            </p>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <TextInput
                                    type="search"
                                    aria-label="Search requests"
                                    placeholder="Search requests"
                                    value={form.q}
                                    onChange={(e) => setForm((current) => ({ ...current, q: e.target.value }))}
                                    className={field}
                                />
                                <select
                                    aria-label="Category"
                                    value={form.category}
                                    onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}
                                    className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                >
                                    <option value="">All categories</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={category.slug}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                                <TextInput
                                    type="search"
                                    aria-label="City"
                                    placeholder="City"
                                    value={form.city}
                                    onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))}
                                    className={field}
                                />
                            </div>
                        </div>

                        {requests.data.length === 0 && (
                            <p className="rounded-lg bg-white p-6 text-center text-sm text-gray-500 shadow dark:bg-gray-800">
                                {scope === 'mine'
                                    ? 'You have not posted a request yet. Post one and technicians will send you quotes.'
                                    : 'No open requests match your search.'}
                            </p>
                        )}

                        <ul className="space-y-3">
                            {requests.data.map((request) => (
                                <li key={request.id}>
                                    <RequestCard request={request} scope={scope} />
                                </li>
                            ))}
                        </ul>

                        <Pagination links={requests.links} />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

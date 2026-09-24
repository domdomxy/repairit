import InputError from '@/Components/InputError';
import { ToggleRow } from '@/Components/ProfileEditParts';
import AdminLayout from '@/Layouts/AdminLayout';
import { Head, useForm } from '@inertiajs/react';

const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600';

const BODY_LIMIT = 2000;

// When each kind of message goes out, as a line under the entry's name.
function whenSent(type, entry) {
    const outcome = entry.label.toLowerCase();

    switch (type) {
        case 'support':
            return 'Sent as soon as a ticket in this category is opened.';
        case 'report':
            return 'Sent as soon as a report with this reason is filed.';
        case 'support_closure':
            if (entry.category === 'inactive') {
                return 'Posted when a ticket waiting on the requester has had no activity for a day and is closed automatically.';
            }

            return `Posted on the ticket, as the support team, when it is marked ${outcome}.`;
        case 'report_closure':
            return `Sent to the person who filed the report when you mark it ${outcome}. Never includes your internal note.`;
        default:
            return '';
    }
}

// One category: its own toggle, its own text, its own save — independent of
// every other row on the page.
function CategoryCard({ type, entry }) {
    const form = useForm({ enabled: entry.enabled, body: entry.body ?? '' });

    const dirty = form.data.enabled !== entry.enabled || form.data.body !== (entry.body ?? '');

    function submit(e) {
        e.preventDefault();
        form.put(route('admin.auto-responses.update', { type, category: entry.category }), { preserveScroll: true });
    }

    return (
        <li className="p-4 sm:p-6">
            <form onSubmit={submit} className="space-y-4">
                <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">{entry.label}</h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{whenSent(type, entry)}</p>
                </div>

                <ToggleRow
                    checked={form.data.enabled}
                    onChange={(checked) => form.setData('enabled', checked)}
                    label="Send automatically"
                />

                {form.data.enabled && (
                    <div>
                        <textarea
                            rows={3}
                            value={form.data.body}
                            onChange={(e) => form.setData('body', e.target.value)}
                            placeholder={entry.default}
                            maxLength={BODY_LIMIT}
                            className={FIELD}
                        />
                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Leave blank to use the default message shown above.</span>
                            <span>
                                {form.data.body.length}/{BODY_LIMIT}
                            </span>
                        </div>
                        <InputError message={form.errors.body} className="mt-1" />
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <button
                        type="submit"
                        disabled={form.processing || !dirty}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                        Save
                    </button>
                    {form.data.body !== '' && (
                        <button
                            type="button"
                            onClick={() => form.setData('body', '')}
                            className="text-sm text-gray-500 hover:underline dark:text-gray-400"
                        >
                            Reset to default
                        </button>
                    )}
                    {form.recentlySuccessful && <span className="text-sm text-green-600 dark:text-green-400">Saved.</span>}
                </div>
            </form>
        </li>
    );
}

function CategoryList({ type, entries }) {
    return (
        <div className="rounded-lg bg-white shadow dark:bg-gray-800">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry) => (
                    <CategoryCard key={entry.category} type={type} entry={entry} />
                ))}
            </ul>
        </div>
    );
}

function Section({ title, description, type, entries }) {
    return (
        <section className="space-y-3">
            <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h2>
                {description && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
            </div>
            <CategoryList type={type} entries={entries} />
        </section>
    );
}

export default function Index({ support, reports, supportClosures, reportClosures }) {
    return (
        <AdminLayout>
            <Head title="Auto-responses" />

            <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
                <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Automatic replies</h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Automatic messages for support tickets and reports: one when they are created, one when they
                        are closed. Turn any of them off, or write your own wording — changes apply from now on.
                    </p>
                </div>

                <Section title="Support tickets: when opened" type="support" entries={support} />

                <Section
                    title="Support tickets: when closed"
                    description="Posted on the ticket when its status changes to resolved or closed, whoever changes it."
                    type="support_closure"
                    entries={supportClosures}
                />

                <Section title="Reports: when filed" type="report" entries={reports} />

                <Section
                    title="Reports: when closed"
                    description="Sent to the person who filed a report when you resolve or dismiss it, once per report."
                    type="report_closure"
                    entries={reportClosures}
                />
            </div>
        </AdminLayout>
    );
}

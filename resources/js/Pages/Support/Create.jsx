import { Head, Link, useForm } from '@inertiajs/react';
import SupportImagePicker from '@/Components/SupportImagePicker';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { BUTTON, BUTTON_QUIET, CARD, FIELD, Field, SideCard, SupportHeader, WITH_SIDE, FILL } from '@/Components/SupportUI';

export default function Create({ categories, attachmentLimits }) {
    const { data, setData, post, processing, errors } = useForm({
        category: '',
        subject: '',
        body: '',
        attachments: [],
    });

    function submit(e) {
        e.preventDefault();
        post(route('support.store'));
    }

    return (
        <AuthenticatedLayout>
            <Head title="New support ticket" />

            <div className="mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
                <SupportHeader title="New support ticket">
                    Tell us what went wrong or what you need. Our replies show up on the ticket.
                </SupportHeader>

                <div className={`${WITH_SIDE} ${FILL}`}>
                    <form onSubmit={submit} className={`${CARD} flex flex-col gap-6 p-5 sm:p-8`}>
                        <div className="grid gap-6 md:grid-cols-2">
                            <Field id="category" label="What is this about?" error={errors.category}>
                                <select
                                    id="category"
                                    value={data.category}
                                    onChange={(e) => setData('category', e.target.value)}
                                    className={FIELD}
                                >
                                    <option value="">Choose a topic</option>
                                    {Object.entries(categories).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field id="subject" label="Subject" error={errors.subject}>
                                <input
                                    id="subject"
                                    type="text"
                                    maxLength={150}
                                    value={data.subject}
                                    onChange={(e) => setData('subject', e.target.value)}
                                    className={FIELD}
                                />
                            </Field>
                        </div>

                        <Field id="body" label="Tell us what happened" error={errors.body} className="flex flex-1 flex-col">
                            <textarea
                                id="body"
                                rows={8}
                                maxLength={5000}
                                value={data.body}
                                onChange={(e) => setData('body', e.target.value)}
                                className={FIELD}
                            />
                        </Field>

                        <SupportImagePicker
                            files={data.attachments}
                            onFilesChange={(files) => setData('attachments', files)}
                            limits={attachmentLimits}
                            errors={errors}
                        />

                        <div className="flex flex-wrap items-center gap-3">
                            <button type="submit" disabled={processing} className={BUTTON}>
                                Send ticket
                            </button>
                            <Link href={route('support.index')} className={BUTTON_QUIET}>
                                Cancel
                            </Link>
                        </div>
                    </form>

                    <aside>
                        <SideCard title="For a faster answer">
                            <p>Say what you were doing and what you expected to happen.</p>
                            <p>When reporting a user, include their name and what they did.</p>
                        </SideCard>
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

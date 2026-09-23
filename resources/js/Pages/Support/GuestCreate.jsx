import { Head, Link, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import { BUTTON, BUTTON_QUIET, CARD, FIELD, Field, SideCard, Steps, SupportHeader, WITH_SIDE, FILL } from '@/Components/SupportUI';

const STEPS = [
    { title: 'Send the form', text: 'You get a ticket ID straight away.' },
    { title: 'Keep your ticket link', text: "It's your only way back in, so bookmark it. We'll email it to you too." },
    { title: 'Check for our reply', text: 'Replies appear on your ticket page.' },
];

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

    return (
        <GuestLayout wide>
            <Head title="Get support" />

            <SupportHeader title="Get support">
                No account needed. We'll give you a ticket ID and a private link to your ticket. That link is how you
                check for a reply.
            </SupportHeader>

            <div className={`${WITH_SIDE} ${FILL}`}>
                <form onSubmit={submit} className={`${CARD} flex flex-col gap-6 p-5 sm:p-8`}>
                    <div className="grid gap-6 md:grid-cols-2">
                        <Field id="name" label="Your name" error={errors.name}>
                            <input
                                id="name"
                                type="text"
                                maxLength={100}
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className={FIELD}
                            />
                        </Field>

                        <Field id="email" label="Your email" error={errors.email}>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className={FIELD}
                            />
                        </Field>
                    </div>

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
                            className={`${FIELD} min-h-[12rem] flex-1`}
                        />
                    </Field>

                    <div className="flex flex-wrap items-center gap-4">
                        <button type="submit" disabled={processing} className={BUTTON}>
                            Send ticket
                        </button>
                    </div>
                </form>

                <aside className="space-y-6">
                    <Steps title="What happens next" steps={STEPS} />

                    <SideCard title="Already have a ticket?">
                        <p>Look it up with your ticket ID and the email you used.</p>
                        <Link href={route('support.guest.track')} className={BUTTON_QUIET}>
                            Find your ticket
                        </Link>
                    </SideCard>
                </aside>
            </div>
        </GuestLayout>
    );
}

import { Head, Link, useForm } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import { BUTTON, BUTTON_QUIET, CARD, FIELD, Field, SideCard, SupportHeader, WITH_SIDE } from '@/Components/SupportUI';

// A guest who lost their ticket link can get back in with the ticket ID they
// were given plus the email they opened it with — there's no password to reset.
export default function GuestTrack() {
    const { data, setData, post, processing, errors } = useForm({ tracking_id: '', email: '' });

    function submit(e) {
        e.preventDefault();
        post(route('support.guest.lookup'));
    }

    return (
        <GuestLayout wide>
            <Head title="Find your ticket" />

            <SupportHeader title="Find your ticket">
                Enter the ticket ID you were given (it looks like SUP-XXXXXX) and the email you used, and we'll take you
                straight to it.
            </SupportHeader>

            <div className={WITH_SIDE}>
                <form onSubmit={submit} className={`${CARD} space-y-6 p-5 sm:p-8`}>
                    <div className="grid gap-6 md:grid-cols-2">
                        <Field id="tracking_id" label="Ticket ID" error={errors.tracking_id}>
                            <input
                                id="tracking_id"
                                type="text"
                                placeholder="SUP-XXXXXX"
                                value={data.tracking_id}
                                onChange={(e) => setData('tracking_id', e.target.value)}
                                className={`${FIELD} font-mono`}
                            />
                        </Field>

                        <Field id="email" label="Email you used" error={errors.email}>
                            <input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                className={FIELD}
                            />
                        </Field>
                    </div>

                    <button type="submit" disabled={processing} className={BUTTON}>
                        Find ticket
                    </button>
                </form>

                <aside>
                    <SideCard title="No ticket yet?">
                        <p>Open one and we'll give you a ticket ID and a link to keep.</p>
                        <Link href={route('support.guest.create')} className={BUTTON_QUIET}>
                            Open a new ticket
                        </Link>
                    </SideCard>
                </aside>
            </div>
        </GuestLayout>
    );
}

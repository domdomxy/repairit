import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { EditHeader, SaveBar, SettingsSection, ToggleRow } from '@/Components/ProfileEditParts';
import { LinksEditor } from '@/Components/ProfileLinks';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';

const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600';

// A customer's own profile page: what technicians see about them. Everything
// here is optional, and the phone number and the email stay hidden unless the
// customer chooses to show them. The picture and the account details are on the
// account page.
export default function EditProfile({ profile }) {
    const user = usePage().props.auth.user;

    const { data, setData, put, errors, processing, recentlySuccessful } = useForm({
        city: profile.city ?? '',
        bio: profile.bio ?? '',
        phone: profile.phone ?? '',
        show_phone_publicly: profile.show_phone_publicly,
        show_email_publicly: profile.show_email_publicly,
        links: profile.links ?? [],
    });

    function submit(e) {
        e.preventDefault();

        put(route('customer.profile.update'), { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Customer Profile" />

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <EditHeader user={user} audience="technicians" publicHref={route('customers.show', user.id)} />

                <form onSubmit={submit} className="mt-6 space-y-6">
                    <SettingsSection title="About you" description="This is what technicians see on your public profile.">
                        <div>
                            <InputLabel htmlFor="city" value="City" />
                            <TextInput
                                id="city"
                                className="mt-1 block w-full"
                                value={data.city}
                                onChange={(e) => setData('city', e.target.value)}
                                maxLength={profile.city_max}
                                autoComplete="address-level2"
                            />
                            <InputError message={errors.city} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="bio" value="Bio" />
                            <textarea
                                id="bio"
                                rows={5}
                                maxLength={profile.bio_max}
                                value={data.bio}
                                onChange={(e) => setData('bio', e.target.value)}
                                placeholder="A few words about you, and what you usually need help with…"
                                className={FIELD}
                            />
                            <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                                {data.bio.length}/{profile.bio_max}
                            </p>
                            <InputError message={errors.bio} className="mt-1" />
                        </div>
                    </SettingsSection>

                    {/* Contact details: hidden unless the customer chooses to show them */}
                    <SettingsSection
                        title="Contact details"
                        description="Technicians can always message you in the app. Your email and phone number are private unless you choose to show them."
                    >
                        <div>
                            <InputLabel htmlFor="phone" value="Phone" />
                            <TextInput
                                id="phone"
                                type="tel"
                                className="mt-1 block w-full"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                maxLength={profile.phone_max}
                                autoComplete="tel"
                            />
                            <InputError message={errors.phone} className="mt-2" />
                        </div>

                        <div className="space-y-5 border-t border-gray-100 pt-6 dark:border-gray-700">
                            <ToggleRow
                                checked={data.show_phone_publicly}
                                onChange={(checked) => setData('show_phone_publicly', checked)}
                                label="Show my phone number"
                                description="On my public profile."
                            />
                            <ToggleRow
                                checked={data.show_email_publicly}
                                onChange={(checked) => setData('show_email_publicly', checked)}
                                label="Show my email"
                                description={`${user.email}, on my public profile.`}
                            />
                        </div>
                    </SettingsSection>

                    {/* Links: a website, social networks... */}
                    <SettingsSection
                        title="Links"
                        description="Add your website or social networks. They are shown on your public profile."
                    >
                        <LinksEditor
                            links={data.links}
                            onChange={(links) => setData('links', links)}
                            errors={errors}
                            max={profile.links_max}
                            labelMax={profile.link_label_max}
                            urlMax={profile.link_url_max}
                        />
                    </SettingsSection>

                    <SaveBar processing={processing} saved={recentlySuccessful} />
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

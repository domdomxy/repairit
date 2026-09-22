import CategoryPicker from '@/Components/CategoryPicker';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import LocationPicker from '@/Components/LocationPicker';
import { EditHeader, OptionCards, SaveBar, SettingsSection, ToggleRow } from '@/Components/ProfileEditParts';
import { LinksEditor } from '@/Components/ProfileLinks';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AVAILABILITY } from '@/lib/availability';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

const BIO_LIMIT = 1000;

const FIELD =
    'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600';

// The three statuses, as choices with the colour of their dot.
const STATUS_OPTIONS = Object.entries(AVAILABILITY).map(([value, { label, dot }]) => ({ value, label, dot }));

const REPLY_OPTIONS = [
    { value: 'default', label: 'Default message' },
    { value: 'custom', label: 'My own message' },
];

export default function EditProfile({ profile, categories, autoReplyDefault, autoReplyMaxLength, linkLimits }) {
    const user = usePage().props.auth.user;

    // Which automatic message is sent: the default one, or the technician's own.
    const [replyMode, setReplyMode] = useState(profile.auto_reply_message ? 'custom' : 'default');

    const { data, setData, put, transform, setError, clearErrors, errors, processing, recentlySuccessful } = useForm({
        bio: profile.bio ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        latitude: profile.latitude,
        longitude: profile.longitude,
        availability_status: profile.availability_status,
        show_phone_publicly: profile.show_phone_publicly,
        show_email_publicly: profile.show_email_publicly,
        auto_reply_enabled: profile.auto_reply_enabled,
        auto_reply_message: profile.auto_reply_message ?? '',
        categories: profile.categories,
        links: profile.links ?? [],
    });

    // The default message is sent by leaving the custom one empty.
    transform((form) => ({
        ...form,
        auto_reply_message: replyMode === 'custom' ? form.auto_reply_message.trim() : null,
    }));

    function submit(e) {
        e.preventDefault();

        if (data.auto_reply_enabled && replyMode === 'custom' && data.auto_reply_message.trim() === '') {
            setError('auto_reply_message', 'Write your message, or choose the default one.');
            return;
        }

        clearErrors('auto_reply_message');
        put(route('technician.profile.update'), { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout>
            <Head title="Technician Profile" />

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <EditHeader user={user} audience="customers" publicHref={route('technicians.show', user.id)} />

                <form onSubmit={submit} className="mt-6 space-y-6">
                    {/* About */}
                    <SettingsSection title="About you" description="This is what customers see on your public profile.">
                        <div>
                            <InputLabel htmlFor="bio" value="Bio" />
                            <textarea
                                id="bio"
                                rows={5}
                                maxLength={BIO_LIMIT}
                                value={data.bio}
                                onChange={(e) => setData('bio', e.target.value)}
                                placeholder="Your experience, the jobs you take on, how you work…"
                                className={FIELD}
                            />
                            <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                                {data.bio.length}/{BIO_LIMIT}
                            </p>
                            <InputError message={errors.bio} className="mt-1" />
                        </div>

                        <CategoryPicker
                            label="Your specialties"
                            categories={categories}
                            value={data.categories}
                            onChange={(ids) => setData('categories', ids)}
                            hint="Customers can find you by these categories."
                            error={errors.categories}
                        />

                        <div>
                            <InputLabel value="Availability" />
                            <div className="mt-2">
                                <OptionCards
                                    label="Availability"
                                    options={STATUS_OPTIONS}
                                    value={data.availability_status}
                                    onChange={(value) => setData('availability_status', value)}
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                Shown on your public profile and used by the availability filter in search.
                            </p>
                            <InputError message={errors.availability_status} className="mt-2" />
                        </div>
                    </SettingsSection>

                    {/* Contact */}
                    <SettingsSection
                        title="Contact details"
                        description="Customers can always message you in the app. Choose whether to show these too."
                    >
                        <div>
                            <InputLabel htmlFor="phone" value="Phone" />
                            <TextInput
                                id="phone"
                                type="tel"
                                className="mt-1 block w-full"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
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
                            max={linkLimits.max}
                            labelMax={linkLimits.label_max}
                            urlMax={linkLimits.url_max}
                        />
                    </SettingsSection>

                    {/* Automatic reply */}
                    <SettingsSection
                        title="Automatic reply"
                        description="Send a message on your behalf when a customer writes to you for the first time. It is sent once per customer, and it is marked as automatic so they know it isn't a personal answer."
                    >
                        <ToggleRow
                            checked={data.auto_reply_enabled}
                            onChange={(checked) => setData('auto_reply_enabled', checked)}
                            label="Reply automatically"
                            description="To a customer's first message."
                        />

                        {data.auto_reply_enabled && (
                            <div className="space-y-4 border-t border-gray-100 pt-6 dark:border-gray-700">
                                <OptionCards
                                    label="Which message is sent"
                                    options={REPLY_OPTIONS}
                                    value={replyMode}
                                    onChange={(value) => {
                                        setReplyMode(value);
                                        clearErrors('auto_reply_message');
                                    }}
                                />

                                {replyMode === 'default' ? (
                                    <p className="whitespace-pre-line rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                        {autoReplyDefault}
                                    </p>
                                ) : (
                                    <div>
                                        <InputLabel htmlFor="auto_reply_message" value="Your message" />
                                        <textarea
                                            id="auto_reply_message"
                                            rows={4}
                                            maxLength={autoReplyMaxLength}
                                            value={data.auto_reply_message}
                                            onChange={(e) => setData('auto_reply_message', e.target.value)}
                                            placeholder="Hi {name}, thanks for your message! I usually answer within a few hours."
                                            className={FIELD}
                                        />
                                        <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                                            {data.auto_reply_message.length}/{autoReplyMaxLength}
                                        </p>
                                    </div>
                                )}

                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    <code>{'{name}'}</code> is replaced with the customer&apos;s first name.
                                </p>
                                <InputError message={errors.auto_reply_message} className="mt-1" />
                            </div>
                        )}
                    </SettingsSection>

                    {/* Location */}
                    <SettingsSection
                        title="Location"
                        description="Search for your address or drop a pin on the map. Only your city is shown publicly."
                        wide
                    >
                        <LocationPicker
                            address={data.address}
                            latitude={data.latitude}
                            longitude={data.longitude}
                            errors={errors}
                            onChange={(fields) => setData((current) => ({ ...current, ...fields }))}
                        />

                        <div className="max-w-xl">
                            <InputLabel htmlFor="city" value="City" />
                            <TextInput
                                id="city"
                                className="mt-1 block w-full"
                                value={data.city}
                                onChange={(e) => setData('city', e.target.value)}
                                autoComplete="address-level2"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Filled in from the map, and you can edit it. Customers who search by city need an exact
                                match, so use the spelling they would type.
                            </p>
                            <InputError message={errors.city} className="mt-2" />
                        </div>
                    </SettingsSection>

                    <SaveBar processing={processing} saved={recentlySuccessful}>
                        <Link
                            href={route('technician.offers.index')}
                            className="text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            Manage offers
                        </Link>
                    </SaveBar>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

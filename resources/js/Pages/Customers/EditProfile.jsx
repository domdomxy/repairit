import Avatar from '@/Components/Avatar';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { LinksEditor } from '@/Components/ProfileLinks';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

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

            <div className="py-12">
                <form onSubmit={submit} className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">About you</h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    This is what technicians see on your public profile.
                                </p>
                            </header>

                            <div className="mt-6 flex items-center gap-4">
                                <Avatar user={user} size="lg" />
                                <Link
                                    href={route('profile.edit')}
                                    className="text-sm text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                                >
                                    {user.avatar_url ? 'Change your profile picture' : 'Add a profile picture'}
                                </Link>
                            </div>

                            <div className="mt-6 space-y-6">
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
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                                    />
                                    <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                                        {data.bio.length}/{profile.bio_max}
                                    </p>
                                    <InputError message={errors.bio} className="mt-1" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Contact details: hidden unless the customer chooses to show them */}
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Contact details
                                </h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    Technicians can always message you in the app. Your email and phone number
                                    are private unless you choose to show them.
                                </p>
                            </header>

                            <div className="mt-6 space-y-4">
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

                                <label className="flex items-center">
                                    <Checkbox
                                        checked={data.show_phone_publicly}
                                        onChange={(e) => setData('show_phone_publicly', e.target.checked)}
                                    />
                                    <span className="ms-2 text-sm text-gray-600 dark:text-gray-400">
                                        Show my phone number on my public profile
                                    </span>
                                </label>

                                <label className="flex items-center">
                                    <Checkbox
                                        checked={data.show_email_publicly}
                                        onChange={(e) => setData('show_email_publicly', e.target.checked)}
                                    />
                                    <span className="ms-2 text-sm text-gray-600 dark:text-gray-400">
                                        Show my email ({user.email}) on my public profile
                                    </span>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* Links: a website, social networks... */}
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Links</h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    Add your website or social networks. They are shown on your public profile.
                                </p>
                            </header>

                            <div className="mt-6">
                                <LinksEditor
                                    links={data.links}
                                    onChange={(links) => setData('links', links)}
                                    errors={errors}
                                    max={profile.links_max}
                                    labelMax={profile.link_label_max}
                                    urlMax={profile.link_url_max}
                                />
                            </div>
                        </div>
                    </section>

                    <div className="flex flex-wrap items-center gap-4 px-4 sm:px-0">
                        <PrimaryButton disabled={processing}>Save</PrimaryButton>

                        <Transition
                            show={recentlySuccessful}
                            enter="transition ease-in-out"
                            enterFrom="opacity-0"
                            leave="transition ease-in-out"
                            leaveTo="opacity-0"
                        >
                            <p className="text-sm text-gray-600 dark:text-gray-400">Saved.</p>
                        </Transition>

                        <Link
                            href={route('customers.show', user.id)}
                            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            See your public profile
                        </Link>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

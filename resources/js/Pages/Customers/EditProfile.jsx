import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

// A customer's own profile page: what technicians see about them. Both fields
// are optional. The picture and the account details are on the account page.
export default function EditProfile({ profile }) {
    const user = usePage().props.auth.user;

    const { data, setData, put, errors, processing, recentlySuccessful } = useForm({
        city: profile.city ?? '',
        bio: profile.bio ?? '',
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
                                    This is what technicians see on your public profile. Your email is never shown.
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

                                <div className="flex flex-wrap items-center gap-4">
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
                            </div>
                        </div>
                    </section>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

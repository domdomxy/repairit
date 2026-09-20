import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Transition } from '@headlessui/react';
import { Link, useForm, usePage } from '@inertiajs/react';

// What a customer shows on their public profile. Both fields are optional.
export default function UpdatePublicInfoForm({ publicInfo, className = '' }) {
    const user = usePage().props.auth.user;

    const { data, setData, patch, errors, processing, recentlySuccessful } = useForm({
        bio: publicInfo.bio ?? '',
        city: publicInfo.city ?? '',
    });

    const submit = (e) => {
        e.preventDefault();

        patch(route('profile.public.update'), { preserveScroll: true });
    };

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Public profile</h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Shown on your profile page to everyone who is signed in, so technicians know who they are
                    talking to. Your email is never shown.
                </p>
            </header>

            <form onSubmit={submit} className="mt-6 space-y-6">
                <div>
                    <InputLabel htmlFor="city" value="City" />

                    <TextInput
                        id="city"
                        className="mt-1 block w-full"
                        value={data.city}
                        onChange={(e) => setData('city', e.target.value)}
                        maxLength={publicInfo.city_max}
                        autoComplete="address-level2"
                    />

                    <InputError className="mt-2" message={errors.city} />
                </div>

                <div>
                    <InputLabel htmlFor="bio" value="About you" />

                    <textarea
                        id="bio"
                        rows={4}
                        maxLength={publicInfo.bio_max}
                        value={data.bio}
                        onChange={(e) => setData('bio', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    />

                    <p className="mt-1 text-right text-xs text-gray-500">
                        {data.bio.length}/{publicInfo.bio_max}
                    </p>

                    <InputError className="mt-2" message={errors.bio} />
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
            </form>
        </section>
    );
}

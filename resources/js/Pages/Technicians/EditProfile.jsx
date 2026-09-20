import Avatar from '@/Components/Avatar';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import LocationPicker from '@/Components/LocationPicker';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Transition } from '@headlessui/react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';

const STATUSES = [
    { value: 'available', label: 'Available' },
    { value: 'busy', label: 'Busy' },
    { value: 'offline', label: 'Offline' },
];

const BIO_LIMIT = 1000;

export default function EditProfile({ profile, categories }) {
    const user = usePage().props.auth.user;

    const { data, setData, put, errors, processing, recentlySuccessful } = useForm({
        bio: profile.bio ?? '',
        phone: profile.phone ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        latitude: profile.latitude,
        longitude: profile.longitude,
        availability_status: profile.availability_status,
        show_phone_publicly: profile.show_phone_publicly,
        show_email_publicly: profile.show_email_publicly,
        categories: profile.categories,
    });

    function toggleCategory(id) {
        setData(
            'categories',
            data.categories.includes(id)
                ? data.categories.filter((c) => c !== id)
                : [...data.categories, id]
        );
    }

    function submit(e) {
        e.preventDefault();
        put(route('technician.profile.update'), { preserveScroll: true });
    }

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
                    Technician Profile
                </h2>
            }
        >
            <Head title="Technician Profile" />

            <div className="py-12">
                <form
                    onSubmit={submit}
                    className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8"
                >
                    {/* About */}
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    About you
                                </h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    This is what customers see on your public profile.
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
                                    <InputLabel htmlFor="bio" value="Bio" />
                                    <textarea
                                        id="bio"
                                        rows={5}
                                        maxLength={BIO_LIMIT}
                                        value={data.bio}
                                        onChange={(e) => setData('bio', e.target.value)}
                                        placeholder="Your experience, the jobs you take on, how you work…"
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                                    />
                                    <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                                        {data.bio.length}/{BIO_LIMIT}
                                    </p>
                                    <InputError message={errors.bio} className="mt-1" />
                                </div>

                                <div>
                                    <InputLabel value="Your specialties" />
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {categories.map((category) => (
                                            <button
                                                type="button"
                                                key={category.id}
                                                onClick={() => toggleCategory(category.id)}
                                                className={`px-3 py-1.5 rounded-full text-sm border ${
                                                    data.categories.includes(category.id)
                                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                            >
                                                {category.name}
                                            </button>
                                        ))}
                                    </div>
                                    <InputError message={errors.categories} className="mt-2" />
                                </div>

                                <div>
                                    <InputLabel value="Availability" />
                                    <div className="mt-2 grid grid-cols-3 gap-3">
                                        {STATUSES.map((status) => (
                                            <button
                                                type="button"
                                                key={status.value}
                                                onClick={() => setData('availability_status', status.value)}
                                                className={`px-4 py-3 rounded-md border text-sm font-medium ${
                                                    data.availability_status === status.value
                                                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                                                        : 'border-gray-300 dark:border-gray-600'
                                                }`}
                                            >
                                                {status.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Shown on your public profile and used by the availability filter in search.
                                    </p>
                                    <InputError message={errors.availability_status} className="mt-2" />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Contact details
                                </h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    Customers can always message you in the app. Choose whether to
                                    show these too.
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

                    {/* Location */}
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <div className="max-w-xl">
                            <header>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Location
                                </h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    Search for your address or drop a pin on the map. Only your city
                                    is shown publicly.
                                </p>
                            </header>

                            <div className="mt-6 space-y-6">
                                <LocationPicker
                                    address={data.address}
                                    latitude={data.latitude}
                                    longitude={data.longitude}
                                    errors={errors}
                                    onChange={(fields) =>
                                        setData((current) => ({ ...current, ...fields }))
                                    }
                                />

                                <div>
                                    <InputLabel htmlFor="city" value="City" />
                                    <TextInput
                                        id="city"
                                        className="mt-1 block w-full"
                                        value={data.city}
                                        onChange={(e) => setData('city', e.target.value)}
                                        autoComplete="address-level2"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Filled in from the map, and you can edit it. Customers who
                                        search by city need an exact match, so use the spelling they
                                        would type.
                                    </p>
                                    <InputError message={errors.city} className="mt-2" />
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center gap-4 px-4 sm:px-0">
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
                            href={route('technician.offers.index')}
                            className="ms-auto text-sm text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                        >
                            Manage offers
                        </Link>

                        <Link
                            href={route('technicians.show', user.id)}
                            className="text-sm text-gray-600 underline dark:text-gray-400"
                        >
                            View public profile
                        </Link>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

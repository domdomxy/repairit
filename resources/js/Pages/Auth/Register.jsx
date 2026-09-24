import { useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { DocumentIcon, WrenchIcon } from '@/Components/Icons';
import GuestLayout from '@/Layouts/GuestLayout';

const ROLES = [
    { value: 'customer', label: 'Customer', blurb: "I've got something that needs fixing", icon: DocumentIcon },
    { value: 'technician', label: 'Technician', blurb: "I fix things for a living", icon: WrenchIcon },
];

export default function Register({ categories }) {
    // Arriving from the welcome page's "Join as a technician" link
    // (/register?role=technician) starts the toggle there instead of on
    // the default "customer".
    const initialRole =
        new URLSearchParams(window.location.search).get('role') === 'technician' ? 'technician' : 'customer';

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: initialRole,
        categories: [],
    });

    useEffect(() => {
        return () => {
            reset('password', 'password_confirmation');
        };
    }, []);

    function toggleCategory(id) {
        setData(
            'categories',
            data.categories.includes(id)
                ? data.categories.filter((c) => c !== id)
                : [...data.categories, id],
        );
    }

    function submit(e) {
        e.preventDefault();
        post(route('register'));
    }

    return (
        <GuestLayout>
            <Head title="Register" />

            <h1 className="font-display text-3xl font-semibold text-gray-900 dark:text-gray-100">
                Create your account
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Takes a minute. You can fill in the rest of your profile after.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
                {/* Role: who is this account for. Sets what the rest of the form asks. */}
                <div>
                    <InputLabel value="I'm registering as a…" />
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {ROLES.map((option) => {
                            const selected = data.role === option.value;
                            const Icon = option.icon;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setData('role', option.value)}
                                    aria-pressed={selected}
                                    className={`rounded-xl border px-3.5 py-3 text-start transition ${
                                        selected
                                            ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-500/10'
                                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                                    }`}
                                >
                                    <Icon
                                        className={`mb-2 h-5 w-5 ${
                                            selected ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-400 dark:text-gray-500'
                                        }`}
                                    />
                                    <span
                                        className={`block text-sm font-semibold ${
                                            selected
                                                ? 'text-indigo-700 dark:text-indigo-300'
                                                : 'text-gray-800 dark:text-gray-200'
                                        }`}
                                    >
                                        {option.label}
                                    </span>
                                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                        {option.blurb}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <InputError message={errors.role} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="name" value="Name" />
                    <TextInput
                        id="name"
                        name="name"
                        value={data.name}
                        className="mt-1.5 block w-full rounded-xl py-2.5"
                        autoComplete="name"
                        isFocused
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="Email" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1.5 block w-full rounded-xl py-2.5"
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <InputLabel htmlFor="password" value="Password" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            value={data.password}
                            className="mt-1.5 block w-full rounded-xl py-2.5"
                            autoComplete="new-password"
                            onChange={(e) => setData('password', e.target.value)}
                            required
                        />
                        <InputError message={errors.password} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="password_confirmation" value="Confirm" />
                        <TextInput
                            id="password_confirmation"
                            type="password"
                            name="password_confirmation"
                            value={data.password_confirmation}
                            className="mt-1.5 block w-full rounded-xl py-2.5"
                            autoComplete="new-password"
                            onChange={(e) => setData('password_confirmation', e.target.value)}
                            required
                        />
                        <InputError message={errors.password_confirmation} className="mt-2" />
                    </div>
                </div>

                {/* Technician-only: category picker. */}
                {data.role === 'technician' && (
                    <div>
                        <InputLabel value="Your trades" />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Pick at least one. Location and contact details come next.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {categories.map((category) => {
                                const selected = data.categories.includes(category.id);

                                return (
                                    <button
                                        type="button"
                                        key={category.id}
                                        onClick={() => toggleCategory(category.id)}
                                        aria-pressed={selected}
                                        className={`rounded-full border px-3 py-1 text-sm transition ${
                                            selected
                                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                                : 'border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-gray-500'
                                        }`}
                                    >
                                        {category.name}
                                    </button>
                                );
                            })}
                        </div>
                        <InputError message={errors.categories} className="mt-2" />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={processing}
                    className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900"
                >
                    {processing ? 'Creating your account…' : 'Create account'}
                </button>

                <p className="border-t border-gray-100 pt-5 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    Already registered?{' '}
                    <Link
                        href={route('login')}
                        className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                        Log in
                    </Link>
                </p>
            </form>
        </GuestLayout>
    );
}

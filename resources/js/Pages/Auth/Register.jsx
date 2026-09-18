import { useEffect } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';

export default function Register({ categories }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'customer',
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
                : [...data.categories, id]
        );
    }

    function submit(e) {
        e.preventDefault();
        post(route('register'));
    }

    return (
        <GuestLayout>
            <Head title="Register" />

            <form onSubmit={submit}>
                <div>
                    <InputLabel htmlFor="name" value="Name" />
                    <TextInput
                        id="name"
                        name="name"
                        value={data.name}
                        className="mt-1 block w-full"
                        autoComplete="name"
                        isFocused
                        onChange={(e) => setData('name', e.target.value)}
                        required
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="email" value="Email" />
                    <TextInput
                        id="email"
                        type="email"
                        name="email"
                        value={data.email}
                        className="mt-1 block w-full"
                        autoComplete="username"
                        onChange={(e) => setData('email', e.target.value)}
                        required
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password" value="Password" />
                    <TextInput
                        id="password"
                        type="password"
                        name="password"
                        value={data.password}
                        className="mt-1 block w-full"
                        autoComplete="new-password"
                        onChange={(e) => setData('password', e.target.value)}
                        required
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div className="mt-4">
                    <InputLabel htmlFor="password_confirmation" value="Confirm Password" />
                    <TextInput
                        id="password_confirmation"
                        type="password"
                        name="password_confirmation"
                        value={data.password_confirmation}
                        className="mt-1 block w-full"
                        autoComplete="new-password"
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        required
                    />
                    <InputError message={errors.password_confirmation} className="mt-2" />
                </div>

                {/* Role selection */}
                <div className="mt-6">
                    <InputLabel value="I am registering as a..." />
                    <div className="mt-2 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setData('role', 'customer')}
                            className={`px-4 py-3 rounded-md border text-sm font-medium ${
                                data.role === 'customer'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                                    : 'border-gray-300 dark:border-gray-600'
                            }`}
                        >
                            Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setData('role', 'technician')}
                            className={`px-4 py-3 rounded-md border text-sm font-medium ${
                                data.role === 'technician'
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30'
                                    : 'border-gray-300 dark:border-gray-600'
                            }`}
                        >
                            Technician
                        </button>
                    </div>
                    <InputError message={errors.role} className="mt-2" />
                </div>

                {/* Technician-only: category picker */}
                {data.role === 'technician' && (
                    <div className="mt-4">
                        <InputLabel value="Your specialties" />
                        <p className="text-xs text-gray-500 mt-1">
                            Select at least one. You can add location and contact details after signing up.
                        </p>
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
                )}

                <div className="mt-6 flex items-center justify-end">
                    <Link
                        href={route('login')}
                        className="rounded-md text-sm text-gray-600 underline dark:text-gray-400"
                    >
                        Already registered?
                    </Link>

                    <PrimaryButton className="ms-4" disabled={processing}>
                        Register
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
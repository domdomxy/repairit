import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { useRef, useState } from 'react';

export default function DeactivateUserForm({ className = '' }) {
    const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);
    const passwordInput = useRef();

    const {
        data,
        setData,
        post,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmDeactivation = () => {
        setConfirmingDeactivation(true);
    };

    const deactivateUser = (e) => {
        e.preventDefault();

        post(route('profile.deactivate'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingDeactivation(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Deactivate Account
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Deactivating hides your profile, offers and requests from
                    everyone else and signs you out, but keeps your data.
                    Simply log back in whenever you're ready to come back —
                    that reactivates your account automatically.
                </p>
            </header>

            <button
                type="button"
                onClick={confirmDeactivation}
                className="inline-flex items-center rounded-md border border-amber-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-widest text-amber-700 shadow-sm transition duration-150 ease-in-out hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-400 dark:hover:bg-amber-900/20 dark:focus:ring-offset-gray-800"
            >
                Deactivate Account
            </button>

            <Modal show={confirmingDeactivation} onClose={closeModal}>
                <form onSubmit={deactivateUser} className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        Deactivate your account?
                    </h2>

                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        You'll be signed out and hidden from other users right
                        away. Nothing is deleted — log back in any time with
                        your usual email and password to reactivate. Please
                        enter your password to confirm.
                    </p>

                    <div className="mt-6">
                        <InputLabel
                            htmlFor="deactivate_password"
                            value="Password"
                            className="sr-only"
                        />

                        <TextInput
                            id="deactivate_password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData('password', e.target.value)
                            }
                            className="mt-1 block w-3/4"
                            isFocused
                            placeholder="Password"
                        />

                        <InputError
                            message={errors.password}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeModal}>
                            Cancel
                        </SecondaryButton>

                        <button
                            type="submit"
                            disabled={processing}
                            className="ms-3 inline-flex items-center rounded-md border border-transparent bg-amber-600 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white transition duration-150 ease-in-out hover:bg-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 active:bg-amber-700 disabled:opacity-25 dark:focus:ring-offset-gray-800"
                        >
                            Deactivate Account
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}

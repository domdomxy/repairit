import OfferCard from '@/Components/OfferCard';
import OfferForm from '@/Components/OfferForm';
import OfferShareActions from '@/Components/OfferShareActions';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Offers({ offers, categories, limits }) {
    const user = usePage().props.auth.user;
    // Which offer is open in the edit form, if any.
    const [editingId, setEditingId] = useState(null);

    function remove(offer) {
        if (!window.confirm(`Delete "${offer.title}"? Its pictures and videos will be deleted too.`)) return;

        router.delete(route('technician.offers.destroy', offer.id), { preserveScroll: true });
    }

    const atLimit = offers.length >= limits.max_offers;

    return (
        <AuthenticatedLayout>
            <Head title="My offers" />

            <div className="py-12">
                <div className="mx-auto max-w-3xl space-y-6 sm:px-6 lg:px-8">
                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <header>
                            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add an offer</h2>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Offers are shown on your public profile. Add pictures or videos of your work to
                                help customers choose you.
                            </p>
                        </header>

                        <div className="mt-6">
                            {atLimit ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    You have reached the limit of {limits.max_offers} offers. Delete one to add
                                    another.
                                </p>
                            ) : (
                                <OfferForm limits={limits} categories={categories} />
                            )}
                        </div>
                    </section>

                    <section className="bg-white p-4 shadow sm:rounded-lg sm:p-8 dark:bg-gray-800">
                        <header className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Your offers
                                </h2>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    {offers.length} of {limits.max_offers}
                                </p>
                            </div>
                            <Link
                                href={route('technicians.show', user.id)}
                                className="shrink-0 text-sm text-gray-600 underline dark:text-gray-400"
                            >
                                View public profile
                            </Link>
                        </header>

                        <div className="mt-6 space-y-4">
                            {offers.length === 0 && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    You have not added any offers yet.
                                </p>
                            )}

                            {offers.map((offer) =>
                                editingId === offer.id ? (
                                    <div key={offer.id} className="rounded-md border p-4 dark:border-gray-700">
                                        <OfferForm
                                            offer={offer}
                                            limits={limits}
                                            categories={categories}
                                            onDone={() => setEditingId(null)}
                                            onCancel={() => setEditingId(null)}
                                        />
                                    </div>
                                ) : (
                                    <OfferCard key={offer.id} offer={offer}>
                                        <div className="flex flex-wrap items-center gap-4 text-sm">
                                            <button
                                                type="button"
                                                onClick={() => setEditingId(offer.id)}
                                                className="text-indigo-600 underline hover:text-indigo-500 dark:text-indigo-400"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => remove(offer)}
                                                className="text-red-600 underline hover:text-red-500"
                                            >
                                                Delete
                                            </button>
                                            <OfferShareActions offer={offer} technicianId={user.id} className="ms-auto" />
                                        </div>
                                    </OfferCard>
                                ),
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

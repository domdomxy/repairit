import OfferForm from '@/Components/OfferForm';
import OfferListing from '@/Components/OfferListing';
import { FEED_CARD } from '@/Components/RequestCard';
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

                    {/* Your offers, listed with the cards of the feed: the same design and the same menu. */}
                    <section aria-label="Your offers" className="space-y-5 px-4 sm:px-0">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-gray-900 dark:text-gray-100">Your offers</span> ·{' '}
                                {offers.length} of {limits.max_offers}
                            </p>
                            <Link
                                href={route('technicians.show', user.id)}
                                className="shrink-0 text-sm text-gray-600 underline dark:text-gray-400"
                            >
                                View public profile
                            </Link>
                        </div>

                        {offers.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-800/40 dark:text-gray-400">
                                You have not added any offers yet.
                            </div>
                        )}

                        {offers.map((offer) =>
                            editingId === offer.id ? (
                                <div key={offer.id} className={FEED_CARD}>
                                    <OfferForm
                                        offer={offer}
                                        limits={limits}
                                        categories={categories}
                                        onDone={() => setEditingId(null)}
                                        onCancel={() => setEditingId(null)}
                                    />
                                </div>
                            ) : (
                                <OfferListing
                                    key={offer.id}
                                    offer={offer}
                                    onEdit={() => setEditingId(offer.id)}
                                    onDelete={() => remove(offer)}
                                />
                            ),
                        )}
                    </section>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

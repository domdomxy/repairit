import OfferListing from '@/Components/OfferListing';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

// One offer on its own page: where a shared link lands.
export default function Show({ offer }) {
    return (
        <AuthenticatedLayout>
            <Head title={offer.title} />

            <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
                <Link href={route('offers.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← All offers
                </Link>

                <OfferListing offer={offer} />
            </div>
        </AuthenticatedLayout>
    );
}

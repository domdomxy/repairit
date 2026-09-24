import OfferListing from '@/Components/OfferListing';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

// One offer on its own page: where a shared link lands. It is the same card as in
// the feed (the technician, the offer, and the buttons to write to them), with the
// description shown in full.
export default function Show({ offer, reportReasons }) {
    return (
        <AuthenticatedLayout>
            <Head title={offer.title} />

            <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <Link href={route('feed.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← Back to the feed
                </Link>

                <div className="mt-4">
                    <OfferListing offer={offer} reportReasons={reportReasons} showKind detail />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

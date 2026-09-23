import Avatar from '@/Components/Avatar';
import FeedKindBadge from '@/Components/FeedKindBadge';
import { PinIcon, StarIcon } from '@/Components/Icons';
import OfferMenu from '@/Components/OfferMenu';
import OfferShareActions from '@/Components/OfferShareActions';
import PostMedia from '@/Components/PostMedia';
import { Banner } from '@/Components/ProfileParts';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { AVAILABILITY } from '@/lib/availability';
import { formatDate, relativeTime } from '@/lib/dates';
import { linkify, POST_LINK_CLASS } from '@/lib/linkify';
import { Head, Link } from '@inertiajs/react';

const CARD = 'rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';

// One offer on its own page: where a shared link lands. The offer itself is on
// the left, and the technician behind it on the right (below it on a small
// screen), with the way to write to them.
export default function Show({ offer, reportReasons }) {
    const technician = offer.technician;
    const availability = AVAILABILITY[technician.availability_status] ?? null;

    return (
        <AuthenticatedLayout>
            <Head title={offer.title} />

            <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
                <Link href={route('feed.index')} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
                    ← Back to the feed
                </Link>

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                    <article className={`${CARD} space-y-6 p-6 sm:p-8`}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <FeedKindBadge kind="offer" />
                                {offer.categories.map((category) => (
                                    <span
                                        key={category.id}
                                        className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                                    >
                                        {category.name}
                                    </span>
                                ))}
                            </div>
                            <OfferMenu offer={offer} reasons={reportReasons} />
                        </div>

                        <div>
                            <h1 className="break-words text-2xl font-semibold leading-tight text-gray-900 dark:text-gray-100 sm:text-3xl">
                                {offer.title}
                            </h1>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400" title={formatDate(offer.created_at)}>
                                Posted {relativeTime(offer.created_at)}
                                <span className="lg:hidden">
                                    {' '}
                                    by{' '}
                                    <Link href={route('technicians.show', technician.id)} className="hover:underline">
                                        <bdi>{technician.name}</bdi>
                                    </Link>
                                </span>
                            </p>
                        </div>

                        {offer.price && (
                            <div className="flex w-fit max-w-full items-baseline gap-3 rounded-xl bg-indigo-50 px-4 py-3 dark:bg-indigo-900/20">
                                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
                                    Price
                                </span>
                                <span className="break-words text-lg font-semibold text-indigo-700 dark:text-indigo-200">
                                    {offer.price}
                                </span>
                            </div>
                        )}

                        {offer.description && (
                            <div>
                                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    About this offer
                                </h2>
                                <p className="mt-2 whitespace-pre-line break-words leading-relaxed text-gray-700 dark:text-gray-300">
                                    {linkify(offer.description, { linkClassName: POST_LINK_CLASS })}
                                </p>
                            </div>
                        )}

                        <PostMedia media={offer.media} />
                    </article>

                    <aside aria-label="Technician" className={`${CARD} overflow-hidden lg:sticky lg:top-[5.5rem]`}>
                        <Banner />

                        <div className="px-6 pb-6">
                            <div className="relative -mt-10 w-fit">
                                <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                                    <Avatar user={technician} size="lg" />
                                </div>
                            </div>

                            <Link
                                href={route('technicians.show', technician.id)}
                                className="mt-3 block break-words text-lg font-semibold text-gray-900 hover:underline dark:text-gray-100"
                            >
                                {technician.name}
                            </Link>

                            {/* Each part is its own item, so an Arabic city cannot reorder the numbers next to it. */}
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                                {technician.city && (
                                    <span className="inline-flex items-center gap-1">
                                        <PinIcon className="h-4 w-4 text-gray-400" />
                                        <bdi>{technician.city}</bdi>
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                    <StarIcon className="h-4 w-4 text-amber-400" />
                                    <span className="font-medium">{technician.rating_avg ?? '—'}</span>
                                    <span className="text-gray-400">({technician.rating_count ?? 0})</span>
                                </span>
                                {availability && (
                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${availability.pill}`}
                                    >
                                        <span className={`h-1.5 w-1.5 rounded-full ${availability.dot}`} />
                                        {availability.label}
                                    </span>
                                )}
                            </div>

                            <div className="mt-5 space-y-2">
                                <OfferShareActions
                                    offer={offer}
                                    technicianId={technician.id}
                                    showCopy={false}
                                    className="[&>button]:w-full [&>button]:py-2 [&>button]:font-medium"
                                />
                                <Link
                                    href={route('technicians.show', technician.id)}
                                    className="block rounded-md border border-gray-300 px-3 py-2 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                                >
                                    View profile
                                </Link>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

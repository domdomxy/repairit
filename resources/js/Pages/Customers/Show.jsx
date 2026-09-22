import { Head, Link, usePage } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';
import { MailIcon, PencilIcon, PhoneIcon, PinIcon, StarIcon } from '@/Components/Icons';
import CreatePanel from '@/Components/CreatePanel';
import RequestCard from '@/Components/RequestCard';
import RequestForm from '@/Components/RequestForm';
import ProfileLinksSection from '@/Components/ProfileLinks';
import { Banner, ContactRow, SIDE_PANEL, Section, Stat } from '@/Components/ProfileParts';
import RelationActions from '@/Components/RelationActions';
import ReviewsPanel from '@/Components/ReviewsPanel';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { useState } from 'react';

// Same three panels as a technician's profile, side by side on wide screens
// and stacked on small ones: who they are on the left, their repair requests
// in the middle, what technicians say about them on the right.
const PANEL = 'rounded-lg bg-white p-6 shadow dark:bg-gray-800';

export default function Show({ customer, requests, relations, requestForm, canReview, myReview, reportReasons }) {
    const { auth } = usePage().props;
    const isOwnProfile = auth.user.id === customer.id;
    const isTechnician = auth.user.role === 'technician';

    const reviews = customer.reviews ?? [];
    const ratingCount = customer.rating_count ?? 0;
    const hasLinks = (customer.links ?? []).length > 0;

    // The request form opens in a panel, like a technician's offer form.
    const [creating, setCreating] = useState(false);

    return (
        <AuthenticatedLayout stickyNav>
            <Head title={customer.name} />

            <div className="flex w-full flex-1 flex-col px-4 pb-8 pt-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row">
                    {/* Left: who the customer is */}
                    <section aria-label="Customer information" className={SIDE_PANEL}>
                        <Banner />

                        <div className="px-6 pb-6">
                            <div className="relative -mt-12 w-fit">
                                <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                                    <Avatar user={customer} size="xl" />
                                </div>
                            </div>

                            <h3 className="mt-3 break-words text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {customer.name}
                            </h3>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                                    Customer
                                </span>
                                {customer.city && (
                                    <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                        <PinIcon className="h-4 w-4 text-gray-400" />
                                        {customer.city}
                                    </span>
                                )}
                            </div>

                            {isOwnProfile && (
                                <Link
                                    href={route('customer.profile.edit')}
                                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                                >
                                    <PencilIcon />
                                    Edit profile
                                </Link>
                            )}

                            {!isOwnProfile && relations?.blocked && (
                                <p className="mt-5 rounded-lg bg-gray-100 px-4 py-2.5 text-center text-sm text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    You blocked {customer.name}.
                                </p>
                            )}

                            {!isOwnProfile && (
                                <RelationActions
                                    person={customer}
                                    relations={relations}
                                    reasons={reportReasons}
                                    collapsible
                                />
                            )}

                            <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 rounded-lg border border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                                <Stat label={ratingCount === 1 ? 'Review' : 'Reviews'}>
                                    {ratingCount > 0 ? (
                                        <>
                                            <StarIcon className="h-4 w-4 text-amber-400" />
                                            {Number(customer.rating_avg).toFixed(1)}
                                        </>
                                    ) : (
                                        '—'
                                    )}
                                </Stat>
                                <Stat label={requests.length === 1 ? 'Request' : 'Requests'}>{requests.length}</Stat>
                                <Stat label="Member since">
                                    {customer.member_since ? new Date(customer.member_since).getFullYear() : '—'}
                                </Stat>
                            </div>

                            <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-700">
                                {customer.bio && (
                                    <Section title="About">
                                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                            {customer.bio}
                                        </p>
                                    </Section>
                                )}

                                {isOwnProfile &&
                                    !customer.bio &&
                                    !customer.city &&
                                    !customer.phone &&
                                    !customer.email &&
                                    !hasLinks && (
                                        <Section title="About">
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Nothing here yet. Add a short bio, your city, contact details or links
                                                by editing your profile so technicians know who they are talking to.
                                            </p>
                                        </Section>
                                    )}

                                {(customer.phone || customer.email) && (
                                    <Section title="Contact">
                                        <div className="space-y-0.5">
                                            {customer.phone && (
                                                <ContactRow
                                                    icon={<PhoneIcon />}
                                                    label="Phone"
                                                    value={customer.phone}
                                                    href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                                                />
                                            )}
                                            {customer.email && (
                                                <ContactRow
                                                    icon={<MailIcon />}
                                                    label="Email"
                                                    value={customer.email}
                                                    href={`mailto:${customer.email}`}
                                                />
                                            )}
                                        </div>
                                    </Section>
                                )}

                                <ProfileLinksSection links={customer.links} />

                            </div>
                        </div>
                    </section>

                    {/* Middle: the create box in a card of its own (on your own profile), then their requests with no panel behind them */}
                    <div className="min-w-0 flex-1 space-y-4">
                        {isOwnProfile && requestForm && (
                            <section aria-label="Create a request" className={PANEL}>
                                <button
                                    type="button"
                                    onClick={() => setCreating(true)}
                                    className="block w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-start text-sm text-gray-500 shadow-sm hover:border-indigo-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
                                >
                                    Create a new request
                                </button>
                            </section>
                        )}

                        <section aria-label="Requests">
                            <div className="mb-3 px-1">
                                <h4 className="font-semibold">Requests</h4>
                            </div>

                            {requests.length === 0 && (
                                <p className="text-sm text-gray-500">
                                    {isOwnProfile
                                        ? 'You have not posted any requests yet.'
                                        : `${customer.name} has no open requests.`}
                                </p>
                            )}
                            <ul className="space-y-3">
                                {requests.map((request) => (
                                    <li key={request.id}>
                                        <RequestCard request={request} scope={isOwnProfile ? 'mine' : 'all'} showAuthor={false} />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {isOwnProfile && requestForm && (
                        <CreatePanel
                            kind="request"
                            show={creating}
                            onClose={() => setCreating(false)}
                            title="Create a new request"
                            description="Describe what needs fixing. Technicians can see it and send you a quote. Your email and phone number are never shown."
                        >
                            <RequestForm
                                categories={requestForm.categories}
                                limits={requestForm.limits}
                                defaultCity={requestForm.defaultCity}
                                inPanel
                                onDone={() => setCreating(false)}
                                onCancel={() => setCreating(false)}
                            />
                        </CreatePanel>
                    )}

                    {/* Right: how technicians rate them */}
                    <ReviewsPanel
                        average={customer.rating_avg}
                        count={ratingCount}
                        reviews={reviews.map((review) => ({
                            id: review.id,
                            rating: review.rating,
                            comment: review.comment,
                            author: review.technician,
                            authorHref: route('technicians.show', review.technician.id),
                        }))}
                        currentUserId={auth.user.id}
                        canRespond={!isOwnProfile && isTechnician}
                        canReview={canReview}
                        lockedText={`Once you and ${customer.name} have exchanged messages, you can rate them.`}
                        myReview={myReview}
                        addLabel="Add review"
                        formProps={{
                            storeUrl: route('customer-reviews.store', customer.id),
                            destroyUrl: route('customer-reviews.destroy', customer.id),
                            placeholder: 'Share how working with them went (optional)',
                        }}
                        reportRoute={(id) => route('customer-reviews.report', id)}
                        reportReasons={reportReasons}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import Avatar from '@/Components/Avatar';
import { MailIcon, PhoneIcon, PinIcon, StarIcon } from '@/Components/Icons';
import { LinkRows } from '@/Components/ProfileLinks';
import RelationActions from '@/Components/RelationActions';
import { AVAILABILITY } from '@/lib/availability';
import { formatDate } from '@/lib/dates';
import { Link } from '@inertiajs/react';

function Section({ title, children }) {
    return (
        <section className="px-5 py-4">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {title}
            </h4>
            <div className="mt-2">{children}</div>
        </section>
    );
}

// One way to reach the person: an icon, what it is, and the value (a link when
// the browser can act on it: call, write an email).
function ContactRow({ icon, label, value, href }) {
    const content = (
        <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <span className="block break-words text-sm font-medium text-gray-800 dark:text-gray-100">{value}</span>
            </span>
        </>
    );

    return href ? (
        <a
            href={href}
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-gray-700/50"
        >
            {content}
        </a>
    ) : (
        <div className="-mx-2 flex items-center gap-3 px-2 py-1.5">{content}</div>
    );
}

function Rating({ average, count }) {
    if (!count) {
        return <span className="text-xs text-gray-500 dark:text-gray-400">No reviews yet</span>;
    }

    return (
        <span className="inline-flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200">
            <StarIcon className="h-4 w-4 text-amber-400" />
            <span className="font-semibold">{Number(average).toFixed(1)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
                ({count} review{count === 1 ? '' : 's'})
            </span>
        </span>
    );
}

// The panel on the right of the messages page: who is on the other side. It can
// be shown or hidden with the "Info" button in the conversation's header (or the
// close button here). When shown it is a column next to the conversation on wide
// screens, and opens over the conversation on narrower ones.
// `reasons` are the report reasons, for the option to report the person.
export default function ConversationInfo({ contact, open, onClose, reasons }) {
    const profile = contact.profile;
    const availability = profile ? AVAILABILITY[profile.availability_status] : null;

    // Technicians carry their rating on the profile, customers on the contact.
    const rating = profile
        ? { average: profile.rating_avg, count: profile.rating_count }
        : contact.role === 'customer' && contact.rating_count !== undefined
          ? { average: contact.rating_avg, count: contact.rating_count }
          : null;

    const profileHref =
        contact.role === 'technician'
            ? route('technicians.show', contact.id)
            : contact.role === 'customer'
              ? route('customers.show', contact.id)
              : null;

    // A technician's phone is on their profile, a customer's on the contact itself.
    const phone = profile?.phone ?? contact.phone;
    const hasContact = !!(phone || contact.email);
    const links = contact.links ?? [];

    return (
        <aside
            className={`${
                open
                    ? 'absolute inset-y-4 end-4 z-20 flex w-80 max-w-full rounded-xl shadow-xl xl:static xl:z-auto xl:w-auto xl:shadow-sm'
                    : 'hidden'
            } min-h-0 flex-col overflow-y-auto rounded-xl bg-white dark:bg-gray-800`}
            aria-label="Contact information"
        >
            {/* Not on the aside itself: it is already positioned (absolute/static) by breakpoint. */}
            <div className="relative">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close contact information"
                    className="absolute end-3 top-3 z-10 rounded-full p-1.5 text-gray-500 transition hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                    >
                        <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                </button>

                {/* Header: a soft banner behind the picture, then who they are. */}
                <div className="shrink-0 bg-gradient-to-b from-indigo-50 to-white px-5 pb-5 pt-8 text-center dark:from-indigo-900/20 dark:to-gray-800">
                    <div className="relative mx-auto w-fit">
                        <div className="rounded-full ring-4 ring-white dark:ring-gray-800">
                            <Avatar user={contact} size="xl" />
                        </div>
                        {availability && (
                            <span
                                title={availability.label}
                                className={`absolute bottom-1 end-1 h-4 w-4 rounded-full ring-2 ring-white dark:ring-gray-800 ${availability.dot}`}
                            />
                        )}
                    </div>

                    <h3 className="mt-3 break-words text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {contact.name}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                            {contact.role}
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

                    {!contact.suspended && (rating || profile?.city) && (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                            {rating && <Rating average={rating.average} count={rating.count} />}
                            {profile?.city && (
                                <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                                    <PinIcon className="h-4 w-4 text-gray-400" />
                                    {profile.city}
                                </span>
                            )}
                        </div>
                    )}

                    {!contact.suspended && profileHref && (
                        <Link
                            href={profileHref}
                            className="mt-4 block rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
                        >
                            View profile
                        </Link>
                    )}
                </div>

                {contact.suspended ? (
                    <p className="px-5 pb-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        This account is suspended.
                    </p>
                ) : (
                    <div className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
                        {profile?.bio && (
                            <Section title="About">
                                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    {profile.bio}
                                </p>
                            </Section>
                        )}

                        {profile?.categories.length > 0 && (
                            <Section title="Specialties">
                                <div className="flex flex-wrap gap-1.5">
                                    {profile.categories.map((name) => (
                                        <span
                                            key={name}
                                            className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                            </Section>
                        )}

                        {hasContact && (
                            <Section title="Contact">
                                <div className="space-y-0.5">
                                    {phone && (
                                        <ContactRow
                                            icon={<PhoneIcon />}
                                            label="Phone"
                                            value={phone}
                                            href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                        />
                                    )}
                                    {contact.email && (
                                        <ContactRow
                                            icon={<MailIcon />}
                                            label="Email"
                                            value={contact.email}
                                            href={`mailto:${contact.email}`}
                                        />
                                    )}
                                </div>
                            </Section>
                        )}

                        {links.length > 0 && (
                            <Section title="Links">
                                <LinkRows links={links} />
                            </Section>
                        )}

                        {contact.member_since && (
                            <p className="px-5 py-3 text-center text-xs text-gray-400 dark:text-gray-500">
                                Member since {formatDate(contact.member_since)}
                            </p>
                        )}
                    </div>
                )}

                {/* Blocking, muting and the rest work on suspended accounts too. */}
                {contact.relations && (
                    <div className="border-t border-gray-100 dark:border-gray-700">
                        <Section title="Manage">
                            <RelationActions person={contact} relations={contact.relations} reasons={reasons} />
                        </Section>
                    </div>
                )}
            </div>
        </aside>
    );
}

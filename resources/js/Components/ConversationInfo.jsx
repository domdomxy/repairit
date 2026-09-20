import Avatar from '@/Components/Avatar';
import { formatDate } from '@/lib/dates';
import { Link } from '@inertiajs/react';

const AVAILABILITY = {
    available: { label: 'Available', dot: 'bg-green-500' },
    busy: { label: 'Busy', dot: 'bg-amber-500' },
    offline: { label: 'Offline', dot: 'bg-gray-400' },
};

function Row({ label, children }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-0.5 break-words text-sm text-gray-800 dark:text-gray-200">{children}</dd>
        </div>
    );
}

// The panel on the right of the messages page: who is on the other side. It can
// be shown or hidden with the "Info" button in the conversation's header (or the
// close button here). When shown it is a column next to the conversation on wide
// screens, and opens over the conversation on narrower ones.
export default function ConversationInfo({ contact, open, onClose }) {
    const profile = contact.profile;
    const availability = profile ? AVAILABILITY[profile.availability_status] : null;

    return (
        <aside
            className={`${
                open
                    ? 'absolute inset-y-4 end-4 z-20 flex w-80 max-w-full rounded-xl shadow-xl xl:static xl:z-auto xl:w-auto xl:shadow-sm'
                    : 'hidden'
            } min-h-0 flex-col overflow-y-auto rounded-xl bg-white dark:bg-gray-800`}
            aria-label="Contact information"
        >
            <div className="flex justify-end px-3 pt-3">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close contact information"
                    className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                    ✕
                </button>
            </div>

            <div className="flex flex-col items-center px-4 py-6 text-center xl:pt-8">
                <Avatar user={contact} size="xl" />
                <h3 className="mt-3 break-words text-lg font-semibold">{contact.name}</h3>
                <span className="mt-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {contact.role}
                </span>
            </div>

            {contact.suspended ? (
                <p className="px-4 pb-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    This account is suspended.
                </p>
            ) : (
                <div className="space-y-4 px-4 pb-6">
                    <dl className="space-y-4">
                        {availability && (
                            <Row label="Status">
                                <span className="inline-flex items-center gap-2">
                                    <span className={`h-2 w-2 rounded-full ${availability.dot}`} />
                                    {availability.label}
                                </span>
                            </Row>
                        )}

                        {profile && (
                            <Row label="Rating">
                                {profile.rating_count > 0
                                    ? `${profile.rating_avg} ★ (${profile.rating_count} review${profile.rating_count === 1 ? '' : 's'})`
                                    : 'No reviews yet'}
                            </Row>
                        )}

                        {profile?.city && <Row label="City">{profile.city}</Row>}

                        {profile?.categories.length > 0 && (
                            <Row label="Specialties">
                                <span className="flex flex-wrap gap-1.5">
                                    {profile.categories.map((name) => (
                                        <span
                                            key={name}
                                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </span>
                            </Row>
                        )}

                        {profile?.bio && <Row label="About"><span className="whitespace-pre-line">{profile.bio}</span></Row>}
                        {profile?.phone && <Row label="Phone">{profile.phone}</Row>}
                        {contact.email && <Row label="Email">{contact.email}</Row>}
                        {contact.member_since && <Row label="Member since">{formatDate(contact.member_since)}</Row>}
                    </dl>

                    {contact.role === 'technician' && (
                        <Link
                            href={route('technicians.show', contact.id)}
                            className="block rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-indigo-700"
                        >
                            View profile
                        </Link>
                    )}
                </div>
            )}
        </aside>
    );
}

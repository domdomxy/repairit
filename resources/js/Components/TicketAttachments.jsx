import MediaLightbox from '@/Components/MediaLightbox';
import { SideCard } from '@/Components/SupportUI';
import { ticketAttachments } from '@/lib/support';
import { useState } from 'react';

// Two rows of three: enough to see what is on the ticket at a glance. The
// last tile says how many more there are, and the viewer steps through all.
const TILES = 6;

/**
 * The side card that gathers every picture on the ticket in one place, so
 * nobody has to scroll the conversation to find one. Reads the thread the
 * page already has, so a picture that arrives live shows up here too.
 * Renders nothing while the ticket has no pictures. `admin` is for the admin
 * page, whose side cards use their own, plainer style.
 */
export default function TicketAttachments({ thread, admin = false }) {
    const [viewing, setViewing] = useState(null);
    const items = ticketAttachments(thread);

    if (items.length === 0) return null;

    const shown = items.slice(0, TILES);
    const hidden = items.length - shown.length;

    const grid = (
        <div className="grid grid-cols-3 gap-2">
            {shown.map((item, index) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => setViewing(index)}
                    aria-label={hidden > 0 && index === shown.length - 1 ? `View all ${items.length} attachments` : `View ${item.name}`}
                    title={item.name}
                    className="relative block aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
                >
                    <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {hidden > 0 && index === shown.length - 1 && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
                            +{hidden}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );

    return (
        <>
            {admin ? (
                <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                    <h3 className="text-xs font-semibold uppercase text-gray-500">Attachments ({items.length})</h3>
                    <div className="mt-3">{grid}</div>
                </section>
            ) : (
                <SideCard title={`Attachments (${items.length})`}>{grid}</SideCard>
            )}

            {viewing !== null && (
                <MediaLightbox
                    attachments={items}
                    index={viewing}
                    onIndexChange={setViewing}
                    onClose={() => setViewing(null)}
                />
            )}
        </>
    );
}

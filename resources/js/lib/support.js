export const statusLabels = {
    open: 'Open',
    in_progress: 'In progress',
    resolved: 'Resolved',
    closed: 'Closed',
};

export const statusStyles = {
    open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

/** How the support team looks to the person who asked for help: a name, never an admin's. */
export const SUPPORT_TEAM = { name: 'Support team', avatar_url: null };

/**
 * Every picture on a ticket, newest first, as one flat list for the
 * "Attachments" card. Each keeps what it needs to be shown on its own
 * (name and url) plus who sent it and when.
 */
export function ticketAttachments(thread) {
    return thread
        .flatMap((message) =>
            (message.attachments ?? []).map((attachment) => ({
                ...attachment,
                message_id: message.id,
                author: message.author,
                created_at: message.created_at,
            })),
        )
        .reverse();
}

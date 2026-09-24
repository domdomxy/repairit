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

const extensionOf = (file) => file.name.split('.').pop()?.toLowerCase();

/**
 * Adds freshly chosen pictures to the ones already waiting, keeping to what the
 * server allows (`limits`: max_files, max_kb, max_total_kb, extensions).
 * Returns the new list and a complaint for every picture that was turned away.
 * Shared by the full picker on the "new ticket" forms and the reply box.
 */
export function addPictures(existing, picked, limits) {
    const complaints = [];
    const next = [...existing];
    let total = next.reduce((sum, file) => sum + file.size, 0);

    for (const file of picked) {
        const duplicate = next.some(
            (other) => other.name === file.name && other.size === file.size && other.lastModified === file.lastModified,
        );

        if (duplicate) continue;

        if (!limits.extensions.includes(extensionOf(file))) {
            complaints.push(`${file.name}: use a JPG, PNG, GIF or WebP picture.`);
        } else if (file.size > limits.max_kb * 1024) {
            complaints.push(`${file.name}: pictures may not be larger than ${limits.max_kb / 1024} MB.`);
        } else if (next.length >= limits.max_files) {
            complaints.push(`You can attach up to ${limits.max_files} pictures to one message.`);
        } else if (total + file.size > limits.max_total_kb * 1024) {
            complaints.push(`${file.name}: the pictures together may not be larger than ${limits.max_total_kb / 1024} MB.`);
        } else {
            next.push(file);
            total += file.size;
        }
    }

    return { files: next, complaints: [...new Set(complaints)] };
}

/**
 * The server's complaints about pictures, from a form's `errors`: one about a
 * single file comes back as `attachments.<position>`, so it is named to make
 * clear which to remove. `rejected` holds the positions of those files.
 */
export function serverPictureProblems(errors, files) {
    const rejected = new Set();
    const messages = Object.entries(errors).flatMap(([key, message]) => {
        const match = key.match(/^attachments\.(\d+)$/);

        if (match) {
            rejected.add(Number(match[1]));

            return [`${files[Number(match[1])]?.name ?? 'A picture'}: ${message}`];
        }

        return key === 'attachments' ? [message] : [];
    });

    return { rejected, messages };
}

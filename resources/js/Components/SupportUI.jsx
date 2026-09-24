import InputError from '@/Components/InputError';
import SupportImagePicker from '@/Components/SupportImagePicker';
import SupportStatusBadge from '@/Components/SupportStatusBadge';

/**
 * Pieces shared by every support page (guest and signed in), so the section reads
 * as one: the same fields, buttons and cards, and a main column with a side column
 * beside it that fills the width instead of a narrow strip.
 */

export const FIELD =
    'mt-1.5 block w-full rounded-xl border-gray-300 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900';

export const CARD = 'rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-800 dark:ring-white/10';

const BUTTON_BASE =
    'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:focus-visible:ring-offset-gray-900';

export const BUTTON = `${BUTTON_BASE} bg-indigo-600 text-white hover:bg-indigo-700`;

export const BUTTON_QUIET = `${BUTTON_BASE} bg-white text-gray-700 shadow-sm ring-1 ring-gray-900/10 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-gray-700`;

/** The main column and a side column that sits beside it from the lg breakpoint up. */
export const WITH_SIDE = 'grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]';

/** Add to WITH_SIDE on a form page so the columns grow to the bottom of the screen (see `grow` on Field). */
export const FILL = 'flex-1 lg:items-stretch';

/** A label, its control and the error under it. */
export function Field({ id, label, error, hint, className = '', children }) {
    return (
        <div className={className}>
            <label htmlFor={id} className="block text-sm font-medium">
                {label}
            </label>
            {children}
            {hint && !error && <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
            <InputError message={error} className="mt-1.5" />
        </div>
    );
}

/** The top of a page: what it is, in a line or two, and an optional action on the right. */
export function SupportHeader({ title, action = null, children }) {
    return (
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
                <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
                {children && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">{children}</p>}
            </div>
            {action}
        </header>
    );
}

/** A titled card for the side column. */
export function SideCard({ title, children }) {
    return (
        <section className={`${CARD} p-5`}>
            <h2 className="font-semibold">{title}</h2>
            <div className="mt-3 space-y-3 text-sm text-gray-600 dark:text-gray-300">{children}</div>
        </section>
    );
}

/** What happens after the ticket is sent: a real sequence, so it is numbered. */
export function Steps({ title, steps }) {
    return (
        <SideCard title={title}>
            <ol className="space-y-4">
                {steps.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                            {index + 1}
                        </span>
                        <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{step.title}</p>
                            <p className="mt-0.5 text-gray-500 dark:text-gray-400">{step.text}</p>
                        </div>
                    </li>
                ))}
            </ol>
        </SideCard>
    );
}

/** The subject with its status beside it, and what the ticket is underneath. */
export function TicketHeader({ ticket }) {
    return (
        <header className="mb-8 min-w-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]">{ticket.subject}</h1>
                <SupportStatusBadge status={ticket.status} />
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-mono">{ticket.tracking_id}</span> in {ticket.category_label}
            </p>
        </header>
    );
}

/** Ticket ID, topic and status, for the side column of a ticket. */
export function TicketDetails({ ticket, children }) {
    return (
        <SideCard title="Ticket details">
            <dl className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Ticket ID</dt>
                    <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">{ticket.tracking_id}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Topic</dt>
                    <dd className="text-right font-medium text-gray-900 dark:text-gray-100">{ticket.category_label}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                    <dd>
                        <SupportStatusBadge status={ticket.status} />
                    </dd>
                </div>
            </dl>
            {children}
        </SideCard>
    );
}

/**
 * The reply form under a conversation. `form` is the useForm() object with a `body`
 * field, and an `attachments` field (an array of files) when `attachmentLimits` is
 * given: the person asking for help can attach pictures, with or without text.
 * `onTyping`, when given, is called as they type (it tells the other side, live).
 */
export function ReplyBox({ ticket, form, onSubmit, attachmentLimits = null, onTyping = null, children }) {
    const { data, setData, processing, errors } = form;
    const hasPictures = attachmentLimits && data.attachments?.length > 0;

    return (
        <form onSubmit={onSubmit} className={`${CARD} space-y-4 p-5 sm:p-6`}>
            <Field
                id="reply"
                label={ticket.status === 'resolved' ? 'Not solved? Reply to reopen it' : 'Reply'}
                error={errors.body}
            >
                <textarea
                    id="reply"
                    rows={5}
                    maxLength={5000}
                    value={data.body}
                    onChange={(e) => {
                        setData('body', e.target.value);
                        onTyping?.();
                    }}
                    className={FIELD}
                />
            </Field>
            {attachmentLimits && (
                <SupportImagePicker
                    files={data.attachments}
                    onFilesChange={(files) => setData('attachments', files)}
                    limits={attachmentLimits}
                    errors={errors}
                />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="submit" disabled={processing || (!data.body.trim() && !hasPictures)} className={BUTTON}>
                    Send reply
                </button>
                {children}
            </div>
        </form>
    );
}

/** Shown in place of the reply form once a ticket is closed. */
export function ClosedNotice({ children }) {
    return <p className={`${CARD} p-5 text-center text-sm text-gray-500 dark:text-gray-400`}>{children}</p>;
}

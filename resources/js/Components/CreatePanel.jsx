import { TagIcon, WrenchIcon, XIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';

// The icon in the panel's header: a wrench for a repair request, a tag for an offer.
const KIND_ICONS = {
    request: WrenchIcon,
    offer: TagIcon,
};

// A panel over the page to write a post: a new or an edited request or offer.
// It can only be closed with its own buttons, so a stray click outside never
// throws away a half-written post. The layer behind it is almost clear, so the
// page stays readable, and the panel is lifted off it by its border and shadow.
//
// The header stays put while the form scrolls when it is taller than the screen.
// `kind` is 'request' or 'offer'.
export default function CreatePanel({ show, onClose, kind, title, description, children }) {
    const Icon = KIND_ICONS[kind] ?? WrenchIcon;

    return (
        <Modal
            show={show}
            onClose={onClose}
            closeable={false}
            maxWidth="2xl"
            backdrop="bg-black/[0.04] dark:bg-black/25"
            panelClassName="rounded-2xl bg-white shadow-2xl ring-1 ring-gray-900/10 dark:bg-gray-800 dark:ring-white/10"
        >
            <header className="flex items-start gap-4 border-b border-gray-100 px-6 py-5 dark:border-gray-700">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
                    {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            </header>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-6 py-6">{children}</div>
        </Modal>
    );
}

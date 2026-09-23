import { TagIcon, WrenchIcon, XIcon } from '@/Components/Icons';
import Modal from '@/Components/Modal';
import { InPanelContext } from '@/Components/PanelFooter';

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
// The header stays put while the form scrolls when it is taller than the screen, and so
// does the form's footer with its buttons. Both are kept slim.
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
            <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold leading-tight text-gray-900 dark:text-gray-100">{title}</h2>
                    {description && (
                        <p className="mt-0.5 text-xs leading-snug text-gray-500 dark:text-gray-400">{description}</p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-1 shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </header>

            {/* The form scrolls under the header; its footer (PanelFooter) stays at the bottom. */}
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-5 py-4">
                <InPanelContext.Provider value={true}>{children}</InPanelContext.Provider>
            </div>
        </Modal>
    );
}

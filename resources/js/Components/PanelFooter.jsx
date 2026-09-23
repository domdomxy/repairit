import { createContext, useContext } from 'react';

// True inside a CreatePanel. The buttons of a form are in a PanelFooter, which
// there stays at the bottom of the panel while the form scrolls, and on a page
// of its own is just the row of buttons at the end of the form.
export const InPanelContext = createContext(false);

export default function PanelFooter({ children }) {
    const inPanel = useContext(InPanelContext);

    return (
        <div
            className={
                inPanel
                    ? 'sticky bottom-0 z-10 -mx-5 -mb-4 flex items-center justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800'
                    : 'flex items-center justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700'
            }
        >
            {children}
        </div>
    );
}

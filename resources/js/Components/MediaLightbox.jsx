import Modal from '@/Components/Modal';
import PlayIcon from '@/Components/PlayIcon';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useEffect } from 'react';

// A full-size viewer for one or more pictures/clips, with previous/next
// controls and a thumbnail strip when there is more than one. Used both for
// a stack of media sent together and, with a single item, as a plain viewer.
//
// `onRemove(attachmentId, scope)`, when given, adds a menu to delete just the
// file currently shown (its own message row) without leaving the viewer.
export default function MediaLightbox({ attachments, index, onIndexChange, onClose, onImageLoad, isMine, onRemove }) {
    const attachment = attachments[index];
    const count = attachments.length;

    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape') onClose();
            if (count > 1 && e.key === 'ArrowRight') onIndexChange((index + 1) % count);
            if (count > 1 && e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count);
        }

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [index, count, onIndexChange, onClose]);

    if (!attachment) return null;

    return (
        <Modal show onClose={onClose} maxWidth="4xl">
            <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                    <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                        {attachment.name}
                        {count > 1 && <span className="ml-2 text-xs font-normal opacity-70">{index + 1} / {count}</span>}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                        <a
                            href={attachment.url}
                            download={attachment.name ?? true}
                            className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                            Download
                        </a>
                        {onRemove && (
                            <Menu>
                                <MenuButton
                                    aria-label="Delete this file"
                                    className="text-sm text-red-600 hover:underline dark:text-red-400"
                                >
                                    Delete
                                </MenuButton>
                                <MenuItems
                                    anchor="bottom end"
                                    className="z-[60] w-44 rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 [--anchor-gap:6px] focus:outline-none dark:bg-gray-700"
                                >
                                    <MenuItem>
                                        <button
                                            type="button"
                                            onClick={() => onRemove(attachment.id, 'me')}
                                            className="block w-full px-4 py-2 text-start text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800"
                                        >
                                            Delete for me
                                        </button>
                                    </MenuItem>
                                    {isMine && (
                                        <MenuItem>
                                            <button
                                                type="button"
                                                onClick={() => onRemove(attachment.id, 'everyone')}
                                                className="block w-full px-4 py-2 text-start text-gray-700 data-[focus]:bg-gray-100 dark:text-gray-300 dark:data-[focus]:bg-gray-800"
                                            >
                                                Delete for everyone
                                            </button>
                                        </MenuItem>
                                    )}
                                </MenuItems>
                            </Menu>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                <div className="relative flex max-h-[80vh] items-center justify-center overflow-auto bg-gray-100 p-2 dark:bg-gray-900">
                    {count > 1 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange((index - 1 + count) % count)}
                            aria-label="Previous"
                            className="absolute left-2 z-10 rounded-full bg-black/40 p-2 text-lg text-white hover:bg-black/60"
                        >
                            ‹
                        </button>
                    )}

                    {attachment.is_video ? (
                        <video
                            key={attachment.id}
                            src={attachment.url}
                            controls
                            autoPlay
                            className="max-h-[75vh] max-w-full"
                        />
                    ) : (
                        <img
                            src={attachment.url}
                            alt={attachment.name ?? 'Image'}
                            onLoad={onImageLoad}
                            className="max-h-[75vh] max-w-full object-contain"
                        />
                    )}

                    {count > 1 && (
                        <button
                            type="button"
                            onClick={() => onIndexChange((index + 1) % count)}
                            aria-label="Next"
                            className="absolute right-2 z-10 rounded-full bg-black/40 p-2 text-lg text-white hover:bg-black/60"
                        >
                            ›
                        </button>
                    )}
                </div>

                {count > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto border-t border-gray-200 p-2 dark:border-gray-700">
                        {attachments.map((item, i) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => onIndexChange(i)}
                                aria-label={`Show ${item.name ?? 'file'}`}
                                className={`relative h-12 w-12 shrink-0 overflow-hidden rounded ${
                                    i === index ? 'ring-2 ring-indigo-500' : 'opacity-60 hover:opacity-100'
                                }`}
                            >
                                {item.is_video ? (
                                    <>
                                        <video src={item.url} className="h-full w-full object-cover" />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                                            <PlayIcon className="h-6 w-6" />
                                        </span>
                                    </>
                                ) : (
                                    <img src={item.url} alt="" className="h-full w-full object-cover" />
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}

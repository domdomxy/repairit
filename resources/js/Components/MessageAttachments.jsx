import Modal from '@/Components/Modal';
import { formatSize } from '@/lib/files';
import { useState } from 'react';

// The files of a message: pictures are shown inline (side by side when there
// are several), everything else is a chip with its name and size. Pictures
// and PDFs open in a viewer inside the app instead of a new browser tab;
// anything else (docx, zip, ...) can only be downloaded, since the browser
// has no built-in way to show it.
export default function MessageAttachments({ attachments, onImageLoad, className = '' }) {
    const [viewing, setViewing] = useState(null);

    const images = attachments.filter((attachment) => attachment.is_image);
    const files = attachments.filter((attachment) => !attachment.is_image);

    return (
        <div className={`space-y-2 ${className}`}>
            {images.length > 0 && (
                <div className={images.length > 1 ? 'grid grid-cols-2 gap-1' : ''}>
                    {images.map((image) => (
                        <button
                            key={image.id}
                            type="button"
                            onClick={() => setViewing(image)}
                            className="block"
                        >
                            <img
                                src={image.url}
                                alt={image.name ?? 'Image'}
                                onLoad={onImageLoad}
                                className={
                                    images.length > 1
                                        ? 'h-28 w-full rounded-md object-cover'
                                        : 'max-h-60 rounded-md'
                                }
                            />
                        </button>
                    ))}
                </div>
            )}

            {files.map((file) =>
                file.is_pdf ? (
                    <button
                        key={file.id}
                        type="button"
                        onClick={() => setViewing(file)}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span aria-hidden="true">📎</span>
                        <span className="break-all underline">{file.name}</span>
                        <span className="shrink-0 text-xs opacity-75">{formatSize(file.size)}</span>
                    </button>
                ) : (
                    <a
                        key={file.id}
                        href={file.url}
                        download={file.name ?? true}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span aria-hidden="true">📎</span>
                        <span className="break-all underline">{file.name}</span>
                        <span className="shrink-0 text-xs opacity-75">{formatSize(file.size)}</span>
                    </a>
                ),
            )}

            <Modal show={viewing !== null} onClose={() => setViewing(null)} maxWidth={viewing?.is_pdf ? 'screen' : '4xl'}>
                {viewing && (
                    <div className="flex flex-col">
                        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
                            <span className="min-w-0 truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                                {viewing.name}
                            </span>
                            <div className="flex shrink-0 items-center gap-3">
                                <a
                                    href={viewing.url}
                                    download={viewing.name ?? true}
                                    className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Download
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setViewing(null)}
                                    aria-label="Close"
                                    className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="flex max-h-[85vh] items-center justify-center overflow-auto bg-gray-100 p-2 dark:bg-gray-900">
                            {viewing.is_image ? (
                                <img
                                    src={viewing.url}
                                    alt={viewing.name ?? 'Image'}
                                    className="max-h-[80vh] max-w-full object-contain"
                                />
                            ) : (
                                <iframe
                                    title={viewing.name}
                                    src={viewing.url}
                                    className="h-[80vh] w-full rounded bg-white"
                                />
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

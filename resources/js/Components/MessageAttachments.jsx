import Modal from '@/Components/Modal';
import PlayIcon from '@/Components/PlayIcon';
import { formatSize } from '@/lib/files';
import { useState } from 'react';

// The files of a message: pictures and clips are shown inline (side by side
// when there are several), everything else is a chip with its name and size.
// Pictures, clips, and PDFs open in a viewer inside the app instead of a new
// browser tab; anything else (docx, zip, ...) can only be downloaded, since
// the browser has no built-in way to show it.
//
// Several pictures or clips chosen and sent together arrive as their own
// message rows sharing a `batch_id` and are shown as a stack by
// `MediaStackRow` instead of here; this component renders whatever is left
// over: a single picture or clip, or files that aren't media at all.
export default function MessageAttachments({ attachments, onImageLoad, className = '' }) {
    const [viewing, setViewing] = useState(null);

    const media = attachments.filter((attachment) => attachment.is_image || attachment.is_video);
    const files = attachments.filter((attachment) => !attachment.is_image && !attachment.is_video);

    return (
        <div className={`space-y-2 ${className}`}>
            {media.length > 0 && (
                <div className={media.length > 1 ? 'grid grid-cols-2 gap-1' : ''}>
                    {media.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setViewing(item)}
                            className={`relative block overflow-hidden ${media.length > 1 ? 'rounded-md' : ''}`}
                        >
                            {item.is_video ? (
                                <>
                                    <video
                                        src={item.url}
                                        onLoadedData={onImageLoad}
                                        className={media.length > 1 ? 'h-28 w-full rounded-md object-cover' : 'max-h-60 rounded-md'}
                                    />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                        <PlayIcon className={media.length > 1 ? 'h-10 w-10' : 'h-14 w-14'} />
                                    </span>
                                </>
                            ) : (
                                <img
                                    src={item.url}
                                    alt={item.name ?? 'Image'}
                                    onLoad={onImageLoad}
                                    className={
                                        media.length > 1
                                            ? 'h-28 w-full rounded-md object-cover'
                                            : 'max-h-60 rounded-md'
                                    }
                                />
                            )}
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
                            ) : viewing.is_video ? (
                                <video src={viewing.url} controls autoPlay className="max-h-[80vh] max-w-full" />
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

import { formatSize } from '@/lib/files';

// The files of a message bubble: pictures are shown inline (side by side when
// there are several), everything else is a download link. Both go through the
// authorised attachment route.
export default function MessageAttachments({ attachments, onImageLoad, className = '' }) {
    const images = attachments.filter((attachment) => attachment.is_image);
    const files = attachments.filter((attachment) => !attachment.is_image);

    return (
        <div className={`space-y-2 ${className}`}>
            {images.length > 0 && (
                <div className={images.length > 1 ? 'grid grid-cols-2 gap-1' : ''}>
                    {images.map((image) => (
                        <a key={image.id} href={image.url} target="_blank" rel="noopener noreferrer">
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
                        </a>
                    ))}
                </div>
            )}

            {files.map((file) => (
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
            ))}
        </div>
    );
}

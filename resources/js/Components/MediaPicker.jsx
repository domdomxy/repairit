import InputLabel from '@/Components/InputLabel';
import SecondaryButton from '@/Components/SecondaryButton';
import { formatSize } from '@/lib/files';
import { useEffect, useRef, useState } from 'react';

// One file waiting to be uploaded, with a thumbnail (a picture, or the first
// frame of a video).
function PendingFile({ file, error, onRemove }) {
    const [previewUrl, setPreviewUrl] = useState(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    // The preview is a temporary browser URL: made when the file appears and
    // let go of when it is removed.
    useEffect(() => {
        if (!isVideo && !isImage) return undefined;

        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [file]);

    return (
        <li
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                error ? 'bg-red-50 dark:bg-red-950' : 'bg-gray-100 dark:bg-gray-700'
            }`}
        >
            {previewUrl && isVideo ? (
                <video src={`${previewUrl}#t=0.1`} preload="metadata" muted className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : previewUrl ? (
                <img src={previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
                <span aria-hidden="true">📎</span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate">{file.name}</span>
                <span className="text-xs text-gray-500">
                    {isVideo ? 'Video' : 'Picture'} · {formatSize(file.size)}
                </span>
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="text-gray-500 hover:text-gray-700"
            >
                ✕
            </button>
        </li>
    );
}

/**
 * The pictures and videos part of a form (a repair request's, like an offer's).
 * They can be chosen in as many rounds as needed; when editing, the ones
 * already saved (`saved`) can be marked for removal.
 *
 * The form owns the state: `files` are the chosen File objects, `removeIds`
 * the saved ones marked for removal, `errors` the form's server errors (a
 * complaint about one file comes back as `media.<position>`). `limits` carries
 * max_files, image_max_kb, video_max_kb, max_total_kb and the two extension
 * lists. `noun` is what the files belong to ("request").
 */
export default function MediaPicker({
    files,
    onFilesChange,
    saved = [],
    removeIds = [],
    onRemoveIdsChange,
    limits,
    errors = {},
    noun = 'request',
}) {
    const fileInput = useRef(null);
    const [fileProblems, setFileProblems] = useState([]);

    const kept = saved.length - removeIds.length;

    const extensionOf = (file) => file.name.split('.').pop()?.toLowerCase();

    function toggleRemoval(id) {
        onRemoveIdsChange(removeIds.includes(id) ? removeIds.filter((existing) => existing !== id) : [...removeIds, id]);
    }

    // Add to what is already chosen, so files can be picked in several rounds.
    function pickFiles(e) {
        const picked = Array.from(e.target.files ?? []);
        // Clear the input so choosing the same file again still fires onChange.
        e.target.value = '';

        const problems = [];
        const next = [...files];
        let total = next.reduce((sum, file) => sum + file.size, 0);

        for (const file of picked) {
            const extension = extensionOf(file);
            const isImage = limits.image_extensions.includes(extension);
            const isVideo = limits.video_extensions.includes(extension);
            const maxKb = isVideo ? limits.video_max_kb : limits.image_max_kb;

            if (
                next.some(
                    (existing) =>
                        existing.name === file.name &&
                        existing.size === file.size &&
                        existing.lastModified === file.lastModified,
                )
            ) {
                continue;
            }

            if (!isImage && !isVideo) {
                problems.push(`${file.name}: use a JPG, PNG, WebP or GIF picture, or an MP4, WebM or MOV video.`);
            } else if (file.size > maxKb * 1024) {
                problems.push(`${file.name}: ${isVideo ? 'videos' : 'pictures'} may not be larger than ${maxKb / 1024} MB.`);
            } else if (kept + next.length >= limits.max_files) {
                problems.push(`A ${noun} can have up to ${limits.max_files} pictures and videos in total.`);
            } else if (total + file.size > limits.max_total_kb * 1024) {
                problems.push(`${file.name}: the files together may not be larger than ${limits.max_total_kb / 1024} MB.`);
            } else {
                next.push(file);
                total += file.size;
            }
        }

        setFileProblems([...new Set(problems)]);
        onFilesChange(next);
    }

    // Server complaints about one file: name the file so it is clear which one to remove.
    const serverProblems = Object.entries(errors).flatMap(([key, message]) => {
        const match = key.match(/^media\.(\d+)$/);

        if (match) return [`${files[Number(match[1])]?.name ?? 'A file'}: ${message}`];
        if (key === 'media') return [message];

        return [];
    });
    const problems = [...new Set([...fileProblems, ...serverProblems])];
    const rejected = new Set(
        Object.keys(errors)
            .map((key) => key.match(/^media\.(\d+)$/)?.[1])
            .filter((position) => position !== undefined)
            .map(Number),
    );

    const accept = [...limits.image_extensions, ...limits.video_extensions].map((ext) => `.${ext}`).join(',');
    const full = kept + files.length >= limits.max_files;

    return (
        <div>
            <InputLabel value="Pictures and videos (optional)" />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Show what is broken: it helps technicians give you a better quote.
            </p>

            {saved.length > 0 && (
                <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {saved.map((item) => {
                        const removing = removeIds.includes(item.id);

                        return (
                            <li key={item.id} className="space-y-1">
                                <div className={`relative overflow-hidden rounded-md ${removing ? 'opacity-40' : ''}`}>
                                    {item.type === 'video' ? (
                                        <video
                                            src={`${item.url}#t=0.1`}
                                            preload="metadata"
                                            muted
                                            className="h-20 w-full bg-black object-cover"
                                        />
                                    ) : (
                                        <img src={item.url} alt={item.name} className="h-20 w-full object-cover" />
                                    )}
                                    {item.type === 'video' && (
                                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">
                                            Video
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleRemoval(item.id)}
                                    className="text-xs text-gray-600 underline dark:text-gray-400"
                                >
                                    {removing ? 'Keep' : 'Remove'}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {files.map((file, index) => (
                        <PendingFile
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            file={file}
                            error={rejected.has(index)}
                            onRemove={() => onFilesChange(files.filter((_, position) => position !== index))}
                        />
                    ))}
                </ul>
            )}

            <input ref={fileInput} type="file" multiple accept={accept} onChange={pickFiles} className="hidden" />
            <div className="mt-2 flex flex-wrap items-center gap-3">
                <SecondaryButton onClick={() => fileInput.current?.click()} disabled={full}>
                    Add pictures or videos
                </SecondaryButton>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Up to {limits.max_files} files · pictures {limits.image_max_kb / 1024} MB each · videos{' '}
                    {limits.video_max_kb / 1024} MB each
                </span>
            </div>

            {problems.length > 0 && (
                <div className="mt-2 space-y-1 text-sm text-red-600">
                    {problems.map((problem) => (
                        <p key={problem}>{problem}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

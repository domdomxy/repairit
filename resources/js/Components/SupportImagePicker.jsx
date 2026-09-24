import { ImageIcon, XIcon } from '@/Components/Icons';
import { formatSize } from '@/lib/files';
import { addPictures, serverPictureProblems } from '@/lib/support';
import { useEffect, useRef, useState } from 'react';

// One picture waiting to be sent, as a thumbnail with a remove button. The
// preview is a temporary browser URL: made when the picture appears and let go
// of when it is removed.
function Thumb({ file, rejected, onRemove }) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        const objectUrl = URL.createObjectURL(file);
        setUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [file]);

    return (
        <li
            className={`relative overflow-hidden rounded-xl ring-1 ${
                rejected ? 'ring-red-400' : 'ring-gray-900/10 dark:ring-white/10'
            }`}
        >
            {url && <img src={url} alt={file.name} className="h-24 w-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-0.5 text-[10px] text-white">
                {formatSize(file.size)}
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Remove ${file.name}`}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition hover:bg-black/80"
            >
                <XIcon className="h-3.5 w-3.5" />
            </button>
        </li>
    );
}

/**
 * The "attach pictures" part of a support form, for the person asking for help
 * (signed in or a guest). Pictures only. The form owns the state: `files` are
 * the chosen File objects, `errors` the form's server errors (a complaint about
 * one file comes back as `attachments.<position>`), and `limits` is what the
 * server allows (max_files, max_kb, max_total_kb, extensions).
 *
 * They can be chosen in several rounds, and dropped onto the button.
 */
export default function SupportImagePicker({
    files,
    onFilesChange,
    limits,
    errors = {},
    label = 'Pictures (optional)',
}) {
    const input = useRef(null);
    const [problems, setProblems] = useState([]);
    const [dragging, setDragging] = useState(false);

    const full = files.length >= limits.max_files;

    function addFiles(picked) {
        const result = addPictures(files, picked, limits);

        setProblems(result.complaints);
        onFilesChange(result.files);
    }

    function pick(e) {
        const picked = Array.from(e.target.files ?? []);
        // Clear the input so choosing the same picture again still fires onChange.
        e.target.value = '';

        addFiles(picked);
    }

    function drop(e) {
        e.preventDefault();
        setDragging(false);

        if (!full) addFiles(Array.from(e.dataTransfer.files ?? []));
    }

    // Server complaints: name the picture when it is about one, so it is clear which to remove.
    const { rejected, messages: serverProblems } = serverPictureProblems(errors, files);
    const shown = [...new Set([...problems, ...serverProblems])];

    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {files.length}/{limits.max_files}
                </span>
            </div>

            {files.length > 0 && (
                <ul className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {files.map((file, index) => (
                        <Thumb
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            file={file}
                            rejected={rejected.has(index)}
                            onRemove={() => onFilesChange(files.filter((_, position) => position !== index))}
                        />
                    ))}
                </ul>
            )}

            <input
                ref={input}
                type="file"
                multiple
                accept={limits.extensions.map((extension) => `.${extension}`).join(',')}
                onChange={pick}
                className="hidden"
            />
            <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!full) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={drop}
                disabled={full}
                className={`mt-2 flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-start transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                    dragging
                        ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
                        : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-gray-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/10'
                }`}
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                    <ImageIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">Add pictures</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                        A screenshot helps. Up to {limits.max_files} pictures, {limits.max_kb / 1024} MB each.
                    </span>
                </span>
            </button>

            {shown.length > 0 && (
                <div className="mt-2 space-y-1 text-sm text-red-600">
                    {shown.map((problem) => (
                        <p key={problem}>{problem}</p>
                    ))}
                </div>
            )}
        </div>
    );
}

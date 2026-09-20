import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { formatSize } from '@/lib/files';
import { useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const DESCRIPTION_LIMIT = 2000;

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

// The form to add an offer, or (with `offer`) to edit one. Pictures and videos
// are chosen in as many rounds as needed; when editing, the ones already saved
// can be marked for removal.
export default function OfferForm({ offer = null, categories = [], limits, onDone, onCancel }) {
    const fileInput = useRef(null);
    const [fileProblems, setFileProblems] = useState([]);

    const { data, setData, post, processing, progress, errors, reset } = useForm({
        // PHP only reads uploaded files from a real POST, so an edit is sent as
        // a POST that Laravel treats as a PUT.
        ...(offer ? { _method: 'put' } : {}),
        title: offer?.title ?? '',
        description: offer?.description ?? '',
        price: offer?.price ?? '',
        categories: offer?.categories?.map((category) => category.id) ?? [],
        media: [],
        remove_media: [],
    });

    const savedMedia = offer?.media ?? [];
    const kept = savedMedia.length - data.remove_media.length;

    function extensionOf(file) {
        return file.name.split('.').pop()?.toLowerCase();
    }

    function toggleCategory(id) {
        setData(
            'categories',
            data.categories.includes(id)
                ? data.categories.filter((existing) => existing !== id)
                : [...data.categories, id],
        );
    }

    function toggleRemoval(id) {
        setData(
            'remove_media',
            data.remove_media.includes(id)
                ? data.remove_media.filter((existing) => existing !== id)
                : [...data.remove_media, id],
        );
    }

    function removeFile(index) {
        setData(
            'media',
            data.media.filter((_, position) => position !== index),
        );
    }

    // Add to what is already chosen, so files can be picked in several rounds.
    function pickFiles(e) {
        const picked = Array.from(e.target.files ?? []);
        // Clear the input so choosing the same file again still fires onChange.
        e.target.value = '';

        const problems = [];
        const next = [...data.media];
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
                problems.push(
                    `${file.name}: ${isVideo ? 'videos' : 'pictures'} may not be larger than ${maxKb / 1024} MB.`,
                );
            } else if (kept + next.length >= limits.max_files) {
                problems.push(`An offer can have up to ${limits.max_files} pictures and videos in total.`);
            } else if (total + file.size > limits.max_total_kb * 1024) {
                problems.push(
                    `${file.name}: the files together may not be larger than ${limits.max_total_kb / 1024} MB.`,
                );
            } else {
                next.push(file);
                total += file.size;
            }
        }

        setFileProblems([...new Set(problems)]);
        setData('media', next);
    }

    function submit(e) {
        e.preventDefault();

        post(offer ? route('technician.offers.update', offer.id) : route('technician.offers.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setFileProblems([]);
                onDone?.();
            },
        });
    }

    // Server complaints about one file come back as `media.<position>`; name
    // the file so it is clear which one to remove.
    const serverProblems = Object.entries(errors).flatMap(([key, message]) => {
        const match = key.match(/^media\.(\d+)$/);

        if (match) return [`${data.media[Number(match[1])]?.name ?? 'A file'}: ${message}`];
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
    const full = kept + data.media.length >= limits.max_files;

    return (
        <form onSubmit={submit} className="space-y-5">
            <div>
                <InputLabel htmlFor={`title-${offer?.id ?? 'new'}`} value="Title" />
                <TextInput
                    id={`title-${offer?.id ?? 'new'}`}
                    className="mt-1 block w-full"
                    value={data.title}
                    maxLength={120}
                    onChange={(e) => setData('title', e.target.value)}
                    placeholder="e.g. Boiler service and safety check"
                />
                <InputError message={errors.title} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor={`price-${offer?.id ?? 'new'}`} value="Price (optional)" />
                <TextInput
                    id={`price-${offer?.id ?? 'new'}`}
                    className="mt-1 block w-full"
                    value={data.price}
                    maxLength={60}
                    onChange={(e) => setData('price', e.target.value)}
                    placeholder="e.g. From 50 TND, or 80 TND / hour"
                />
                <InputError message={errors.price} className="mt-2" />
            </div>

            <div>
                <InputLabel value="Categories" />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Tag the offer with one or more categories, so customers can find it by them.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {categories.map((category) => {
                        const selected = data.categories.includes(category.id);

                        return (
                            <button
                                key={category.id}
                                type="button"
                                onClick={() => toggleCategory(category.id)}
                                aria-pressed={selected}
                                className={`rounded-full border px-3 py-1 text-sm transition ${
                                    selected
                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                        : 'border-gray-300 text-gray-700 hover:border-indigo-400 dark:border-gray-600 dark:text-gray-300'
                                }`}
                            >
                                {category.name}
                            </button>
                        );
                    })}
                </div>
                <InputError message={errors.categories ?? errors['categories.0']} className="mt-2" />
            </div>

            <div>
                <InputLabel htmlFor={`description-${offer?.id ?? 'new'}`} value="Description (optional)" />
                <textarea
                    id={`description-${offer?.id ?? 'new'}`}
                    rows={4}
                    maxLength={DESCRIPTION_LIMIT}
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    placeholder="What is included, how long it takes, any conditions…"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
                />
                <p className="mt-1 text-right text-xs text-gray-500 dark:text-gray-400">
                    {data.description.length}/{DESCRIPTION_LIMIT}
                </p>
                <InputError message={errors.description} className="mt-1" />
            </div>

            <div>
                <InputLabel value="Pictures and videos" />

                {savedMedia.length > 0 && (
                    <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {savedMedia.map((item) => {
                            const removing = data.remove_media.includes(item.id);

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

                {data.media.length > 0 && (
                    <ul className="mt-2 space-y-1">
                        {data.media.map((file, index) => (
                            <PendingFile
                                key={`${file.name}-${file.size}-${file.lastModified}`}
                                file={file}
                                error={rejected.has(index)}
                                onRemove={() => removeFile(index)}
                            />
                        ))}
                    </ul>
                )}

                <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept={accept}
                    onChange={pickFiles}
                    className="hidden"
                />
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

            <div className="flex items-center gap-3">
                <PrimaryButton disabled={processing}>
                    {processing && progress ? `Uploading ${progress.percentage}%` : offer ? 'Save offer' : 'Add offer'}
                </PrimaryButton>
                {onCancel && (
                    <SecondaryButton onClick={onCancel} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                )}
            </div>
        </form>
    );
}

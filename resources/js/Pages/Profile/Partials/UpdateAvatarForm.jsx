import Avatar from '@/Components/Avatar';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const PICTURE_SIZE = 512;

// Crop to a centred square and shrink, as a JPEG. That keeps uploads small,
// respects the phone's rotation and drops hidden data such as GPS location.
// If the browser can't do it, the original file is sent as it is.
async function preparePicture(file) {
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const side = Math.min(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.min(PICTURE_SIZE, side);

        const context = canvas.getContext('2d');
        // JPEG has no transparency; without this a see-through PNG turns black.
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
            bitmap,
            (bitmap.width - side) / 2,
            (bitmap.height - side) / 2,
            side,
            side,
            0,
            0,
            canvas.width,
            canvas.height,
        );
        bitmap.close?.();

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));

        return blob ? new File([blob], 'avatar.jpg', { type: 'image/jpeg' }) : file;
    } catch {
        return file;
    }
}

export default function UpdateAvatarForm({ avatar, className = '' }) {
    const user = usePage().props.auth.user;
    const fileInput = useRef(null);
    const [preview, setPreview] = useState(null);
    const [pickError, setPickError] = useState(null);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        avatar: null,
    });

    // The preview is a temporary browser URL; let go of it when it changes.
    useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

    // Forget the chosen picture (the input, the preview and the form data).
    function clearSelection() {
        reset();
        clearErrors();
        setPreview(null);
        if (fileInput.current) fileInput.current.value = '';
    }

    // Cancel, or done saving: forget the picture and any complaint about it.
    function discard() {
        clearSelection();
        setPickError(null);
    }

    async function pick(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        clearErrors();
        setPickError(null);

        const extension = file.name.split('.').pop()?.toLowerCase();
        if (!avatar.extensions.includes(extension)) {
            clearSelection();
            setPickError('Use a JPG, PNG or WebP picture.');
            return;
        }

        const prepared = await preparePicture(file);

        if (prepared.size > avatar.max_kb * 1024) {
            clearSelection();
            setPickError(`The picture may not be larger than ${avatar.max_kb / 1024} MB.`);
            return;
        }

        setData('avatar', prepared);
        setPreview(URL.createObjectURL(prepared));
    }

    function save(e) {
        e.preventDefault();
        if (!data.avatar) return;

        post(route('profile.avatar.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: discard,
        });
    }

    function remove() {
        if (!window.confirm('Remove your profile picture?')) return;

        router.delete(route('profile.avatar.destroy'), { preserveScroll: true });
    }

    const error = pickError ?? errors.avatar;

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Profile picture
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Shown next to your name in messages, reviews and search results.
                </p>
            </header>

            <form onSubmit={save} className="mt-6 flex items-center gap-6">
                <Avatar src={preview ?? user.avatar_url} name={user.name} size="xl" />

                <div className="space-y-3">
                    <input
                        ref={fileInput}
                        type="file"
                        accept={avatar.extensions.map((extension) => `.${extension}`).join(',')}
                        onChange={pick}
                        className="hidden"
                    />

                    {preview ? (
                        <div className="flex flex-wrap gap-3">
                            <PrimaryButton disabled={processing}>Save picture</PrimaryButton>
                            <SecondaryButton onClick={discard} disabled={processing}>
                                Cancel
                            </SecondaryButton>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            <SecondaryButton onClick={() => fileInput.current?.click()}>
                                {user.avatar_url ? 'Change picture' : 'Choose picture'}
                            </SecondaryButton>
                            {user.avatar_url && (
                                <SecondaryButton onClick={remove}>Remove</SecondaryButton>
                            )}
                        </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        JPG, PNG or WebP. It is cropped to a square.
                    </p>

                    <InputError message={error} />
                </div>
            </form>
        </section>
    );
}

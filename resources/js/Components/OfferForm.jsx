import CategoryPicker from '@/Components/CategoryPicker';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MediaPicker from '@/Components/MediaPicker';
import SecondaryButton from '@/Components/SecondaryButton';
import SubmitButton from '@/Components/SubmitButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';
import { useState } from 'react';

const DESCRIPTION_LIMIT = 2000;

// The form to add an offer, or (with `offer`) to edit one. Pictures and videos
// are chosen in as many rounds as needed (see MediaPicker); when editing, the
// ones already saved can be marked for removal.
export default function OfferForm({ offer = null, categories = [], limits, onDone, onCancel }) {
    // Bumped once an offer is saved, so the picker forgets the complaints
    // about files from the round before.
    const [round, setRound] = useState(0);

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

    function submit(e) {
        e.preventDefault();

        post(offer ? route('technician.offers.update', offer.id) : route('technician.offers.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setRound((current) => current + 1);
                onDone?.();
            },
        });
    }

    return (
        <form onSubmit={submit} className="space-y-6">
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

            <CategoryPicker
                categories={categories}
                value={data.categories}
                onChange={(ids) => setData('categories', ids)}
                hint="Tag the offer with one or more categories, so customers can find it by them."
                error={errors.categories ?? errors['categories.0']}
            />

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

            <MediaPicker
                key={round}
                files={data.media}
                onFilesChange={(files) => setData('media', files)}
                saved={offer?.media ?? []}
                removeIds={data.remove_media}
                onRemoveIdsChange={(ids) => setData('remove_media', ids)}
                limits={limits}
                errors={errors}
                noun="offer"
                label="Pictures and videos"
                hint={null}
            />

            <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-700">
                {onCancel && (
                    <SecondaryButton onClick={onCancel} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                )}
                <SubmitButton disabled={processing}>
                    {processing && progress ? `Uploading ${progress.percentage}%` : offer ? 'Save offer' : 'Add offer'}
                </SubmitButton>
            </div>
        </form>
    );
}

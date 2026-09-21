import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MediaPicker from '@/Components/MediaPicker';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { Link, useForm } from '@inertiajs/react';

// The form to post a repair request, or (with `serviceRequest`) to edit one.
//
// Used on its own page and in the "new request" and "edit request" panels of
// the feed and of the profiles. `inPanel` tells the server the request is saved
// from such a panel, so the person stays on that page instead of being sent to
// the request's own page. Cancel is a link to `cancelHref` on the page, and
// `onCancel` in the panel; `onDone` runs once the request is saved.
export default function RequestForm({
    serviceRequest = null,
    categories,
    limits,
    defaultCity = null,
    inPanel = false,
    cancelHref = null,
    onCancel = null,
    onDone,
}) {
    const editing = serviceRequest !== null;

    const { data, setData, post, processing, progress, errors } = useForm({
        // PHP only reads uploaded files from a real POST, so an edit is sent as
        // a POST that Laravel treats as a PUT.
        ...(editing ? { _method: 'put' } : {}),
        ...(inPanel ? { from_panel: true } : {}),
        description: serviceRequest?.description ?? '',
        budget: serviceRequest?.budget ?? '',
        city: serviceRequest?.city ?? defaultCity ?? '',
        categories: serviceRequest?.categories?.map((category) => category.id) ?? [],
        media: [],
        remove_media: [],
    });

    function toggleCategory(id) {
        setData(
            'categories',
            data.categories.includes(id) ? data.categories.filter((existing) => existing !== id) : [...data.categories, id],
        );
    }

    function submit(e) {
        e.preventDefault();

        if (editing) {
            post(route('requests.update', serviceRequest.id), {
                forceFormData: true,
                // In a panel the page behind it stays where it is.
                preserveScroll: inPanel,
                onSuccess: () => onDone?.(),
            });
        } else {
            post(route('requests.store'), { forceFormData: true, preserveScroll: true, onSuccess: () => onDone?.() });
        }
    }

    return (
        <form onSubmit={submit} className="space-y-6">
            <div>
                <InputLabel htmlFor="description" value="What needs fixing?" />
                <textarea
                    id="description"
                    rows={6}
                    autoFocus
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    maxLength={limits.description_max}
                    placeholder="e.g. My phone screen cracked. It is a Samsung A52, and I need it fixed this week."
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                />
                <p className="mt-1 text-right text-xs text-gray-500">
                    {data.description.length}/{limits.description_max}
                </p>
                <InputError message={errors.description} className="mt-2" />
            </div>

            <div>
                <InputLabel value="Categories" />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Pick up to {limits.max_categories}, so technicians can find your request by them.
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

            <div className="grid gap-6 sm:grid-cols-2">
                <div>
                    <InputLabel htmlFor="budget" value="Budget (optional)" />
                    <TextInput
                        id="budget"
                        className="mt-1 block w-full"
                        value={data.budget}
                        onChange={(e) => setData('budget', e.target.value)}
                        maxLength={limits.budget_max}
                        placeholder="e.g. Up to 100 TND"
                    />
                    <InputError message={errors.budget} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="city" value="City (optional)" />
                    <TextInput
                        id="city"
                        className="mt-1 block w-full"
                        value={data.city}
                        onChange={(e) => setData('city', e.target.value)}
                        maxLength={limits.city_max}
                        autoComplete="address-level2"
                    />
                    <InputError message={errors.city} className="mt-2" />
                </div>
            </div>

            <MediaPicker
                files={data.media}
                onFilesChange={(files) => setData('media', files)}
                saved={serviceRequest?.media ?? []}
                removeIds={data.remove_media}
                onRemoveIdsChange={(ids) => setData('remove_media', ids)}
                limits={limits}
                errors={errors}
                noun="request"
            />

            <div className="flex items-center gap-3">
                <PrimaryButton disabled={processing}>
                    {processing && progress ? `Uploading ${progress.percentage}%` : editing ? 'Save changes' : 'Post request'}
                </PrimaryButton>
                {onCancel ? (
                    <SecondaryButton onClick={onCancel} disabled={processing}>
                        Cancel
                    </SecondaryButton>
                ) : (
                    cancelHref && (
                        <Link href={cancelHref}>
                            <SecondaryButton>Cancel</SecondaryButton>
                        </Link>
                    )
                )}
            </div>
        </form>
    );
}

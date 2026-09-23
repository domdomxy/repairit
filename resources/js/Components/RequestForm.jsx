import CategoryPicker from '@/Components/CategoryPicker';
import CityPicker from '@/Components/CityPicker';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MediaPicker from '@/Components/MediaPicker';
import MoneyInput from '@/Components/MoneyInput';
import PanelFooter from '@/Components/PanelFooter';
import SecondaryButton from '@/Components/SecondaryButton';
import SubmitButton from '@/Components/SubmitButton';
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
        <form onSubmit={submit} className="space-y-4">
            <div>
                <div className="flex items-baseline justify-between gap-3">
                    <InputLabel htmlFor="description" value="What needs fixing?" />
                    <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                        {data.description.length}/{limits.description_max}
                    </span>
                </div>
                <textarea
                    id="description"
                    rows={5}
                    autoFocus
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    maxLength={limits.description_max}
                    placeholder="e.g. My phone screen cracked. It is a Samsung A52, and I need it fixed this week."
                    required
                    className="mt-1 block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                />
                <InputError message={errors.description} className="mt-1" />
            </div>

            <CategoryPicker
                categories={categories}
                value={data.categories}
                onChange={(ids) => setData('categories', ids)}
                hint={`Pick up to ${limits.max_categories}, so technicians can find your request by them.`}
                error={errors.categories ?? errors['categories.0']}
            />

            <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput
                    id="budget"
                    label="Budget (optional)"
                    value={data.budget}
                    onChange={(value) => setData('budget', value)}
                    maxLength={limits.budget_max}
                    placeholder="e.g. up to 100"
                    error={errors.budget}
                />

                <CityPicker
                    value={data.city}
                    onChange={(value) => setData('city', value)}
                    myCity={defaultCity}
                    maxLength={limits.city_max}
                    error={errors.city}
                />
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

            <PanelFooter>
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
                <SubmitButton disabled={processing}>
                    {processing && progress ? `Uploading ${progress.percentage}%` : editing ? 'Save changes' : 'Post request'}
                </SubmitButton>
            </PanelFooter>
        </form>
    );
}

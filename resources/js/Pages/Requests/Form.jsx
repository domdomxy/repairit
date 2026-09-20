import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm } from '@inertiajs/react';

// Post a repair request, or edit one you posted.
export default function Form({ serviceRequest, categories, limits, defaultCity }) {
    const editing = serviceRequest !== null;

    const { data, setData, post, put, processing, errors } = useForm({
        title: serviceRequest?.title ?? '',
        description: serviceRequest?.description ?? '',
        budget: serviceRequest?.budget ?? '',
        city: serviceRequest?.city ?? defaultCity ?? '',
        categories: serviceRequest?.categories?.map((category) => category.id) ?? [],
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
            put(route('requests.update', serviceRequest.id));
        } else {
            post(route('requests.store'));
        }
    }

    const cancelHref = editing ? route('requests.show', serviceRequest.id) : route('requests.mine');

    return (
        <AuthenticatedLayout>
            <Head title={editing ? 'Edit request' : 'Post a request'} />

            <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
                <form onSubmit={submit} className="space-y-6 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                    <header>
                        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {editing ? 'Edit your request' : 'Post a repair request'}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            Describe what needs fixing. Technicians can see it and send you a quote. Your email and
                            phone number are never shown.
                        </p>
                    </header>

                    <div>
                        <InputLabel htmlFor="title" value="What needs fixing?" />
                        <TextInput
                            id="title"
                            className="mt-1 block w-full"
                            value={data.title}
                            onChange={(e) => setData('title', e.target.value)}
                            maxLength={limits.title_max}
                            placeholder="e.g. Cracked phone screen"
                            required
                            isFocused
                        />
                        <InputError message={errors.title} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="description" value="Details" />
                        <textarea
                            id="description"
                            rows={6}
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            maxLength={limits.description_max}
                            placeholder="What is broken, the make and model, what happened, when you need it done..."
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

                    <div className="flex items-center gap-3">
                        <PrimaryButton disabled={processing}>{editing ? 'Save changes' : 'Post request'}</PrimaryButton>
                        <Link href={cancelHref}>
                            <SecondaryButton>Cancel</SecondaryButton>
                        </Link>
                    </div>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}

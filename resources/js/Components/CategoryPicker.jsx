import { CheckIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';

// The categories of a post as chips to switch on and off, with what they are
// for underneath the label (`label` says "Categories" unless told otherwise). `value` is the ids
// picked, `onChange` gets the new list.
export default function CategoryPicker({ categories, value, onChange, hint, error, label = 'Categories' }) {
    function toggle(id) {
        onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id]);
    }

    return (
        <div>
            <InputLabel value={label} />
            {hint && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}

            <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((category) => {
                    const selected = value.includes(category.id);

                    return (
                        <button
                            key={category.id}
                            type="button"
                            onClick={() => toggle(category.id)}
                            aria-pressed={selected}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                                selected
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20'
                            }`}
                        >
                            {selected && <CheckIcon className="h-3.5 w-3.5" />}
                            {category.name}
                        </button>
                    );
                })}
            </div>

            <InputError message={error} className="mt-2" />
        </div>
    );
}

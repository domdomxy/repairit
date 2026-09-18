import { Link } from '@inertiajs/react';

// Renders Laravel's paginator `links` array. Labels such as "&laquo; Previous"
// come from the framework as HTML entities, so they are injected as HTML.
export default function Pagination({ links }) {
    if (!links || links.length <= 3) {
        return null;
    }

    const base = 'px-3 py-1 text-sm rounded-md border';

    return (
        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Pagination">
            {links.map((link, index) =>
                link.url ? (
                    <Link
                        key={index}
                        href={link.url}
                        preserveScroll
                        className={`${base} ${
                            link.active
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ) : (
                    <span
                        key={index}
                        className={`${base} border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600`}
                        dangerouslySetInnerHTML={{ __html: link.label }}
                    />
                ),
            )}
        </nav>
    );
}

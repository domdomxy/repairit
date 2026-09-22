import { StarIcon, TagIcon, WrenchIcon, XIcon } from '@/Components/Icons';
import { OfferPrice } from '@/Components/OfferCard';
import useDismiss from '@/lib/useDismiss';
import { Link, router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

const RECENT_KEY = 'repairit:recent-searches';
const RECENT_LIMIT = 6;
const DEBOUNCE_MS = 250;

/** Recent search terms, newest first, kept in this browser only. */
function loadRecent() {
    try {
        const stored = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');

        return Array.isArray(stored) ? stored.filter((term) => typeof term === 'string') : [];
    } catch {
        return [];
    }
}

function saveRecent(list) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)));
    } catch {
        // Storage can be unavailable (private browsing, quota); the search still works.
    }
}

function ClockIcon({ className = 'h-4 w-4' }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

// One quick-result row: an avatar/thumbnail-or-icon, a title, and a subtitle.
function ResultRow({ href, onNavigate, image, Icon, title, subtitle, trailing }) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-start transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
        >
            {image ? (
                <img src={image} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
            ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    <Icon className="h-4 w-4" />
                </span>
            )}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
                {subtitle && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{subtitle}</span>}
            </span>
            {trailing}
        </Link>
    );
}

/**
 * A search box that opens a panel underneath it: recent searches while it is
 * empty, a handful of live matches per kind while typing, and Enter (or
 * "See all results") for the full search page, which is where any filtering
 * beyond a keyword happens.
 */
export default function SearchBar({ className = '' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [recent, setRecent] = useState([]);
    const [results, setResults] = useState({ technicians: [], offers: [], requests: [] });
    const [loading, setLoading] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const requestId = useRef(0);

    useDismiss(open, containerRef, () => setOpen(false));

    function focus() {
        setRecent(loadRecent());
        setOpen(true);
    }

    // Debounced quick search: fires a bit after typing stops, and ignores a
    // reply that comes back after a newer one was already sent.
    useEffect(() => {
        const term = query.trim();

        if (term === '') {
            setResults({ technicians: [], offers: [], requests: [] });
            setLoading(false);

            return undefined;
        }

        setLoading(true);
        const id = ++requestId.current;

        const timeout = setTimeout(() => {
            window.axios
                .get(route('search.quick'), { params: { q: term } })
                .then(({ data }) => {
                    if (id === requestId.current) setResults(data);
                })
                .catch(() => {
                    if (id === requestId.current) setResults({ technicians: [], offers: [], requests: [] });
                })
                .finally(() => {
                    if (id === requestId.current) setLoading(false);
                });
        }, DEBOUNCE_MS);

        return () => clearTimeout(timeout);
    }, [query]);

    function remember(term) {
        const trimmed = term.trim();
        if (trimmed === '') return;

        const next = [trimmed, ...recent.filter((t) => t.toLowerCase() !== trimmed.toLowerCase())].slice(0, RECENT_LIMIT);
        setRecent(next);
        saveRecent(next);
    }

    function goToResult(term) {
        remember(term);
        setOpen(false);
    }

    function goToSearchPage(term) {
        remember(term);
        setOpen(false);
        inputRef.current?.blur();
        router.get(route('search.index'), term.trim() ? { q: term.trim() } : {});
    }

    function removeRecent(term, e) {
        e.preventDefault();
        e.stopPropagation();
        const next = recent.filter((t) => t !== term);
        setRecent(next);
        saveRecent(next);
    }

    const term = query.trim();
    const hasResults = results.technicians.length + results.offers.length + results.requests.length > 0;

    return (
        <div className={'relative ' + className} ref={containerRef}>
            <svg
                className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                aria-hidden="true"
            >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>

            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={focus}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        goToSearchPage(query);
                    }
                }}
                placeholder="Search technicians, offers and requests"
                aria-label="Search technicians, offers and requests"
                autoComplete="off"
                className="w-full truncate rounded-md border-gray-300 bg-gray-50 py-2 pl-10 pr-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:focus:border-indigo-600 dark:focus:ring-indigo-600"
            />

            {open && (
                <div className="absolute start-0 top-full z-50 mt-2 w-[26rem] max-w-[90vw] rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700">
                    <div className="max-h-[26rem] overflow-y-auto p-2">
                        {term === '' ? (
                            recent.length === 0 ? (
                                <p className="px-2 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                                    Your recent searches will show up here.
                                </p>
                            ) : (
                                <>
                                    <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                        Recent
                                    </p>
                                    {recent.map((saved) => (
                                        <button
                                            key={saved}
                                            type="button"
                                            onClick={() => goToSearchPage(saved)}
                                            className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-start transition hover:bg-gray-50 dark:hover:bg-gray-700/40"
                                        >
                                            <ClockIcon className="h-4 w-4 shrink-0 text-gray-400" />
                                            <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">{saved}</span>
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                aria-label={`Remove "${saved}" from recent searches`}
                                                onClick={(e) => removeRecent(saved, e)}
                                                onKeyDown={(e) => e.key === 'Enter' && removeRecent(saved, e)}
                                                className="shrink-0 rounded p-1 text-gray-300 opacity-0 hover:text-gray-500 group-hover:opacity-100 dark:text-gray-500 dark:hover:text-gray-300"
                                            >
                                                <XIcon className="h-3.5 w-3.5" />
                                            </span>
                                        </button>
                                    ))}
                                </>
                            )
                        ) : (
                            <>
                                {loading && results.technicians.length === 0 && results.offers.length === 0 && results.requests.length === 0 && (
                                    <p className="px-2 py-6 text-center text-sm text-gray-400 dark:text-gray-500">Searching…</p>
                                )}

                                {!loading && !hasResults && (
                                    <p className="px-2 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                                        No quick matches for "{term}".
                                    </p>
                                )}

                                {results.technicians.length > 0 && (
                                    <div className="mb-1">
                                        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                            Technicians
                                        </p>
                                        {results.technicians.map((technician) => (
                                            <ResultRow
                                                key={technician.id}
                                                href={route('technicians.show', technician.id)}
                                                onNavigate={() => goToResult(term)}
                                                image={technician.avatar_url}
                                                Icon={StarIcon}
                                                title={technician.name}
                                                subtitle={technician.city}
                                            />
                                        ))}
                                    </div>
                                )}

                                {results.offers.length > 0 && (
                                    <div className="mb-1">
                                        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                            Offers
                                        </p>
                                        {results.offers.map((offer) => (
                                            <ResultRow
                                                key={offer.id}
                                                href={route('offers.show', offer.id)}
                                                onNavigate={() => goToResult(term)}
                                                image={offer.thumbnail_url}
                                                Icon={TagIcon}
                                                title={offer.title}
                                                trailing={<OfferPrice price={offer.price} />}
                                            />
                                        ))}
                                    </div>
                                )}

                                {results.requests.length > 0 && (
                                    <div className="mb-1">
                                        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                            Requests
                                        </p>
                                        {results.requests.map((request) => (
                                            <ResultRow
                                                key={request.id}
                                                href={route('requests.show', request.id)}
                                                onNavigate={() => goToResult(term)}
                                                Icon={WrenchIcon}
                                                title={request.excerpt}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Always available: if the quick matches above aren't it, the full
                        search page has every filter (category, city, availability...). */}
                    <button
                        type="button"
                        onClick={() => goToSearchPage(query)}
                        className="flex w-full items-center justify-between gap-2 rounded-b-lg border-t border-gray-100 px-4 py-2.5 text-start text-sm font-medium text-indigo-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-indigo-400 dark:hover:bg-gray-700/40"
                    >
                        <span>{term === '' ? 'Open search' : `Search for "${term}"`}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">Enter ↵</span>
                    </button>
                </div>
            )}
        </div>
    );
}

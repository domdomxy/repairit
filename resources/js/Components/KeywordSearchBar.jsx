import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Modeled on Discord's in-server search (same component as Synkro's project page):
// typing a filter keyword like "category:" or "city:" locks it into a tag inside
// the bar and opens a panel below it; picking/typing a value turns the whole thing
// into an applied-filter pill you can click to edit. Backspace pops the last
// tag/pill, and the "x" at the end of the bar clears them all.
//
// Plain text typed into the bar (no keyword) is the free-text search term. On the
// technicians page that is the technician's name.
//
// Each filter is one of three kinds:
//   - 'select' (default): a fixed option list, single-select, e.g. availability.
//     value/onChange carry the option's value ('all' means unset).
//   - 'text': free text typed after the keyword, e.g. a city. value/onChange
//     carry a plain string ('' means unset). Applied by pressing Enter.
//   - 'typed-text': an optional type chip (from `types`) plus free text.
//     value/onChange carry { type: string|null, text: string }, applied by
//     pressing Enter once either part is filled in.
//
// Filters can also carry a `category` to group related keywords under a shared
// tab in the "Filter by" suggestion list; filters without a category are listed
// individually beneath any groups. The tabs only appear when there is more than
// one group.
//
// This component only ever pops open the "Filter by" keyword list and a filter's
// value picker. What the free-text term matches is up to the page using it.

function SearchIcon() {
    return (
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    );
}

function FilterTypeIcon() {
    // Small colon-tag glyph, echoes Discord's "from:" / "has:" suggestion rows.
    return (
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10M7 12h10M7 17h6" />
        </svg>
    );
}

// Replace the bar's native horizontal scrollbar (ugly/inconsistent across
// browsers, and unusable on a trackpad-less desktop) with a pair of small
// chevron buttons that page the pill row left/right instead.
function ChevronLeftIcon() {
    return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
    );
}

// The keyword tag shown while a filter is mid-pick (before a value is
// chosen), and the applied-filter pill once a value's picked, share the
// same neutral gray palette across both light and dark theme - light gray
// on the white bar, a visibly lighter gray than the bar's own background in
// dark mode - rather than a stark black tag or an unrelated blue pill.
// The tag shown while a filter is being typed or an applied pill is
// reopened for editing (see editFilter): keyword label plus the live query,
// kept inside ONE pill - same gray background, rounded shape, and h-5 size
// as the settled AppliedPill it replaces mid-edit - rather than a separate
// keyword tag next to a bare, differently-sized text input. Sizing the
// input off the query length keeps the whole pill hugging its content
// instead of stretching to fill the bar.
function EditingPill({ keyword, subTypeLabel, onRemoveSubType, query, onQueryChange, onFocus, onKeyDown, inputRef }) {
    return (
        <span className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded bg-gray-200 pl-1.5 pr-1.5 text-xs font-medium leading-none text-gray-700 dark:bg-gray-700 dark:text-gray-100">
            <span className="font-semibold">{keyword}:</span>
            {subTypeLabel && (
                <span className="flex items-center gap-1 rounded bg-gray-300 px-1.5 py-0.5 text-[11px] leading-none text-gray-800 dark:bg-gray-600 dark:text-gray-100">
                    {subTypeLabel}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveSubType(); }}
                        className="flex h-3 w-3 items-center justify-center rounded hover:bg-gray-400/50 dark:hover:bg-gray-500/50"
                        title="Remove type"
                    >
                        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            )}
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={onQueryChange}
                onFocus={onFocus}
                onKeyDown={onKeyDown}
                size={Math.max(query.length, 1)}
                className="min-w-[6px] border-0 bg-transparent p-0 text-xs leading-none text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100"
            />
        </span>
    );
}

// `onClick` (optional) re-opens the pill for editing - see `editFilter` below.
// `onRemove` (optional) renders a small per-pill remove button; the applied
// top-level filter pills no longer pass this (removing a filter now goes
// through the single "clear all" button at the end of the bar instead - see
// the render below), but the in-progress type-chip shown while composing a
// typed-text filter still uses it to clear just that chip.
function AppliedPill({ children, onClick, onRemove }) {
    return (
        <span
            onClick={onClick}
            className={`inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded bg-gray-200 pl-1.5 pr-1 text-xs font-medium leading-none text-gray-700 dark:bg-gray-700 dark:text-gray-100 ${onClick ? 'cursor-text hover:bg-gray-300 dark:hover:bg-gray-600' : ''}`}
        >
            {children}
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-300 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
                    title="Remove filter"
                >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </span>
    );
}

function filterKind(f) {
    return f.kind || 'select';
}

function isFilterApplied(f) {
    const kind = filterKind(f);
    if (kind === 'text') return typeof f.value === 'string' && f.value.trim() !== '';
    if (kind === 'typed-text') return Boolean(f.value?.type) || Boolean(f.value?.text && f.value.text.trim() !== '');
    return f.value !== 'all';
}

function emptyValueFor(f) {
    const kind = filterKind(f);
    if (kind === 'text') return '';
    if (kind === 'typed-text') return { type: null, text: '' };
    return 'all';
}

function appliedLabel(f) {
    const kind = filterKind(f);
    if (kind === 'select') return `${f.keyword}: ${f.options.find((o) => o.value === f.value)?.label ?? f.value}`;
    if (kind === 'text') return `${f.keyword}: "${f.value}"`;
    const typeLabel = f.value?.type ? f.types.find((t) => t.value === f.value.type)?.label : null;
    const parts = [typeLabel, f.value?.text].filter(Boolean);
    return `${f.keyword}: ${parts.length ? parts.join(' \u00b7 ') : '(any)'}`;
}

// filters: [{ key, keyword, description, category?, kind?, options?, types?, value, onChange }]
export default function KeywordSearchBar({ value, onChange, filters, placeholder = 'Search...', className = '' }) {
    const [open, setOpen] = useState(false);
    // The filter type currently locked into a dark keyword tag (e.g. after
    // typing "status:"), while its value is still being picked. Separate
    // from `value`/`onChange`, which stays the plain free-text search term.
    const [pendingType, setPendingType] = useState(null);
    // Only meaningful for a 'typed-text' filter: the type chip chosen so
    // far (e.g. "file"), before the free-text part is applied.
    const [pendingSubType, setPendingSubType] = useState(null);
    const [pendingQuery, setPendingQuery] = useState('');
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    // On mobile the panel below is `fixed` (viewport-relative) rather than `absolute`
    // (bar-relative) so it can sit centered on the screen instead of off to one side of
    // a bar that no longer spans the same fixed width - see the panel's own comment.
    // `top` has to be measured in JS since a fixed element ignores the bar's position.
    const [mobileDropdownTop, setMobileDropdownTop] = useState(0);
    // Pill row scroll state, for the left/right arrow buttons that replace
    // the native horizontal scrollbar - see the arrow buttons in the render
    // below and the effects that keep these in sync further down.
    const scrollRowRef = useRef(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    // Which category tab is selected in the "Filter by" keyword suggestion
    // list (null = "All"). Lets someone jump straight to e.g. "Comments"
    // instead of scrolling past every other category to find it.
    const [activeCategory, setActiveCategory] = useState(null);
    // Scroll state for the category tab row itself - it can run wider than
    // the dropdown (more categories than fit), so it gets the same
    // chevron-button pattern as the applied-pill row above instead of
    // relying on an undiscoverable trackpad/shift-scroll gesture.
    const tabRowRef = useRef(null);
    const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false);
    const [canScrollTabsRight, setCanScrollTabsRight] = useState(false);

    // A filter currently being edited (see `editFilter`) is pulled out of the
    // applied-pills row and rendered instead via the same keyword-tag +
    // editable-input UI used while typing a brand new filter - so it stays
    // excluded here while pendingType === that filter.
    const appliedFilters = useMemo(
        () => filters.filter((f) => isFilterApplied(f) && f.key !== pendingType?.key),
        [filters, pendingType]
    );
    const availableFilterTypes = useMemo(() => filters.filter((f) => !isFilterApplied(f)), [filters]);
    const hasAppliedFilters = useMemo(() => filters.some(isFilterApplied), [filters]);

    useEffect(() => {
        const handlePointerDown = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setOpen(false);
                // Clicking away from an in-progress or being-edited filter just
                // discards the unsaved edit - it never touched the filter's
                // real value (see editFilter/cancelPending), so the original
                // pill (if any) simply reappears as-is.
                setPendingType(null);
                setPendingSubType(null);
                setPendingQuery('');
                setActiveCategory(null);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, []);

    // Clears the local "currently typing/editing a filter" state without
    // touching the filter's actual value - used once a value has just been
    // successfully applied (see applyValue/applyPending below).
    const resetPendingState = () => {
        setPendingType(null);
        setPendingSubType(null);
        setPendingQuery('');
        setActiveCategory(null);
    };

    // Backs out of a filter that was never finished: either a brand new
    // keyword typed but not completed, or - if it's still applied - an
    // existing pill that was reopened for editing (see editFilter) and then
    // backspaced all the way through. In the latter case the filter is still
    // sitting at its old value (editing never touches it until a new value
    // is actually applied), so this is also where "backspacing into
    // status:" removes the whole tag, rather than leaving it applied.
    const cancelPending = () => {
        if (pendingType && isFilterApplied(pendingType)) {
            pendingType.onChange(emptyValueFor(pendingType));
        }
        resetPendingState();
    };

    const applyValue = (filterType, optionValue) => {
        filterType.onChange(optionValue);
        resetPendingState();
        onChange('');
        setOpen(false);
        inputRef.current?.focus();
    };

    // Re-opens an already-applied pill for inline editing, reusing the same
    // keyword-tag + editable-input flow as typing a brand new filter. The
    // filter's real value is left untouched until the user actually picks/
    // types a new one (applyValue/applyPending) or backs all the way out
    // (cancelPending), so clicking away or losing focus never loses data.
    const editFilter = (f) => {
        const kind = filterKind(f);
        setPendingType(f);
        if (kind === 'select') {
            setPendingSubType(null);
            setPendingQuery(f.options.find((o) => o.value === f.value)?.label ?? '');
        } else if (kind === 'text') {
            setPendingSubType(null);
            setPendingQuery(f.value ?? '');
        } else {
            setPendingSubType(f.value?.type ?? null);
            setPendingQuery(f.value?.text ?? '');
        }
        onChange('');
        setOpen(true);
        inputRef.current?.focus();
    };

    // Clears every applied filter at once - the single "x" at the end of the
    // bar (see render below) that replaced each pill's own remove button.
    const clearAllFilters = () => {
        filters.forEach((f) => {
            if (isFilterApplied(f)) f.onChange(emptyValueFor(f));
        });
        resetPendingState();
        onChange('');
        setOpen(false);
    };

    // Applies a 'text' or 'typed-text' filter from whatever's currently
    // typed/chosen. No-op if there's nothing to apply yet.
    const applyPending = () => {
        if (!pendingType) return;
        const kind = filterKind(pendingType);
        if (kind === 'text') {
            if (pendingQuery.trim() === '') return;
            pendingType.onChange(pendingQuery);
        } else if (kind === 'typed-text') {
            if (!pendingSubType && pendingQuery.trim() === '') return;
            pendingType.onChange({ type: pendingSubType, text: pendingQuery });
        } else {
            return;
        }
        resetPendingState();
        onChange('');
        setOpen(false);
        inputRef.current?.focus();
    };

    const lockKeyword = (filterType) => {
        setPendingType(filterType);
        setPendingSubType(null);
        setPendingQuery('');
        onChange('');
        setOpen(true);
        inputRef.current?.focus();
    };

    const handleTextChange = (raw) => {
        if (pendingType) {
            setPendingQuery(raw);
            return;
        }
        // Auto-lock into a keyword tag the moment a full "status:" / "priority:"
        // is typed, same as Discord converting a finished keyword into a tag.
        const fullMatch = raw.match(/^(\w+):(.*)$/);
        const matchedType = fullMatch && availableFilterTypes.find((f) => f.keyword === fullMatch[1].toLowerCase());
        if (matchedType) {
            setPendingType(matchedType);
            setPendingSubType(null);
            setPendingQuery(fullMatch[2] ?? '');
            onChange('');
            return;
        }
        onChange(raw);
    };

    const handleKeyDown = (e) => {
        const kind = pendingType ? filterKind(pendingType) : null;

        if (e.key === 'Enter' && pendingType && (kind === 'text' || kind === 'typed-text')) {
            e.preventDefault();
            applyPending();
            return;
        }

        if (e.key !== 'Backspace') return;
        if (pendingType) {
            if (pendingQuery === '') {
                if (kind === 'typed-text' && pendingSubType) {
                    setPendingSubType(null);
                } else {
                    cancelPending();
                }
            }
            return;
        }
        if (value !== '') return;
        // Nothing typed - pop the most recently applied pill (last one in
        // the filters list order, mirrors Discord popping the last tag).
        if (appliedFilters.length > 0) {
            const last = appliedFilters[appliedFilters.length - 1];
            last.onChange(emptyValueFor(last));
        }
    };

    const pendingKind = pendingType ? filterKind(pendingType) : null;
    const showValueList = Boolean(pendingType) && pendingKind === 'select';
    const showTextPanel = Boolean(pendingType) && (pendingKind === 'text' || pendingKind === 'typed-text');
    const filteredOptions = showValueList
        ? pendingType.options.filter(
              (o) => o.label.toLowerCase().includes(pendingQuery.toLowerCase()) || o.value.toLowerCase().includes(pendingQuery.toLowerCase())
          )
        : [];
    const typedPrefix = value.trim().toLowerCase();
    // Only worth suggesting keywords while what's typed so far could still
    // be the start of one (e.g. "stat" -> "status:") - once it's longer than
    // any known keyword it's unambiguously free text, whose matches live in
    // SearchResultsPanel instead of this bar's own dropdown.
    const matchingFilterTypes = availableFilterTypes.filter((f) => f.keyword.startsWith(typedPrefix));
    const showKeywordSuggestions = !showValueList && !showTextPanel && !pendingType && matchingFilterTypes.length > 0;
    const showDropdown = open && (showValueList || showTextPanel || showKeywordSuggestions);

    // Re-measures the bar's bottom edge whenever the mobile panel opens, and keeps it
    // in sync if the page scrolls or resizes while it's open (e.g. rotating the device,
    // or the sticky header hiding/showing on scroll - see AuthenticatedLayout).
    useLayoutEffect(() => {
        if (!showDropdown) return;
        const updatePosition = () => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) setMobileDropdownTop(rect.bottom + 6);
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [showDropdown]);
    // Keeps the left/right arrow buttons in sync with how far the pill row
    // can actually scroll. Runs after every render (pills/tags being added
    // or removed changes the row's scrollWidth) as well as on the row's own
    // scroll events and window resizes.
    useLayoutEffect(() => {
        const el = scrollRowRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 1);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    });

    useEffect(() => {
        const el = scrollRowRef.current;
        if (!el) return;
        const updateScrollButtons = () => {
            setCanScrollLeft(el.scrollLeft > 1);
            setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        };
        el.addEventListener('scroll', updateScrollButtons, { passive: true });
        window.addEventListener('resize', updateScrollButtons);
        return () => {
            el.removeEventListener('scroll', updateScrollButtons);
            window.removeEventListener('resize', updateScrollButtons);
        };
    }, []);

    const scrollPillRow = (direction) => {
        scrollRowRef.current?.scrollBy({ left: direction * 120, behavior: 'smooth' });
    };

    // Same idea as the pill row's scroll-button sync above, but for the
    // category tab row - recomputed after every render (opening the
    // dropdown or the matching categories changing both resize it) and on
    // its own scroll/resize events. The row is only ever in the DOM while
    // the dropdown + tabs are visible, so a plain onScroll handler is used
    // instead of an effect-mounted listener that could miss a ref that
    // wasn't attached yet.
    useLayoutEffect(() => {
        const el = tabRowRef.current;
        if (!el) return;
        setCanScrollTabsLeft(el.scrollLeft > 1);
        setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    });

    useEffect(() => {
        const updateTabScrollButtons = () => {
            const el = tabRowRef.current;
            if (!el) return;
            setCanScrollTabsLeft(el.scrollLeft > 1);
            setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        };
        window.addEventListener('resize', updateTabScrollButtons);
        return () => window.removeEventListener('resize', updateTabScrollButtons);
    }, []);

    const handleTabRowScroll = (e) => {
        const el = e.currentTarget;
        setCanScrollTabsLeft(el.scrollLeft > 1);
        setCanScrollTabsRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    const scrollTabRow = (direction) => {
        tabRowRef.current?.scrollBy({ left: direction * 100, behavior: 'smooth' });
    };

    // Group the "Filter by" suggestion list by category (e.g. "Tasks"),
    // preserving first-seen order; filters without a category are listed
    // individually underneath any groups.
    const categoryOrder = [];
    const categorized = {};
    const uncategorized = [];
    matchingFilterTypes.forEach((f) => {
        if (f.category) {
            if (!categorized[f.category]) {
                categorized[f.category] = [];
                categoryOrder.push(f.category);
            }
            categorized[f.category].push(f);
        } else {
            uncategorized.push(f);
        }
    });

    // Falls back to "All" if the selected tab's category no longer has any
    // matching filters (e.g. it narrowed away while typing) rather than
    // rendering an empty pane.
    const effectiveCategory = activeCategory && categoryOrder.includes(activeCategory) ? activeCategory : null;
    // Tabs are only worth showing when there's more than one group to
    // switch between - a single category (or none) has nothing to navigate.
    const showCategoryTabs = categoryOrder.length + (uncategorized.length > 0 ? 1 : 0) > 1;

    const canApplyPending = pendingKind === 'typed-text' ? Boolean(pendingSubType) || pendingQuery.trim() !== '' : pendingQuery.trim() !== '';

    const renderFilterTypeRow = (f) => (
        <button
            key={f.key}
            type="button"
            onClick={() => lockKeyword(f)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
        >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                <FilterTypeIcon />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{f.keyword}:</span>
                <span className="block truncate text-xs text-gray-400 dark:text-gray-500">{f.description}</span>
            </span>
        </button>
    );

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-gray-300 bg-white pl-2.5 pr-1.5 shadow-sm focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900">
                <SearchIcon />
                {canScrollLeft && (
                    <button
                        type="button"
                        onClick={() => scrollPillRow(-1)}
                        className="flex h-5 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title="Scroll left"
                    >
                        <ChevronLeftIcon />
                    </button>
                )}
                {/* .no-scrollbar (app.css) hides the native scrollbar - the row is still
                    fully scrollable by trackpad/touch/drag, and the chevrons above/below
                    give a click target for anyone without one. */}
                <div
                    ref={scrollRowRef}
                    className="no-scrollbar flex min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-x-auto"
                    onClick={() => inputRef.current?.focus()}
                >
                    {appliedFilters.map((f) => (
                        <AppliedPill key={f.key} onClick={() => editFilter(f)}>
                            {appliedLabel(f)}
                        </AppliedPill>
                    ))}
                    {pendingType ? (
                        <EditingPill
                            keyword={pendingType.keyword}
                            subTypeLabel={
                                pendingKind === 'typed-text' && pendingSubType
                                    ? pendingType.types.find((t) => t.value === pendingSubType)?.label
                                    : null
                            }
                            onRemoveSubType={() => setPendingSubType(null)}
                            query={pendingQuery}
                            onQueryChange={(e) => { handleTextChange(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            onKeyDown={handleKeyDown}
                            inputRef={inputRef}
                        />
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => { handleTextChange(e.target.value); setOpen(true); }}
                            onFocus={() => setOpen(true)}
                            onKeyDown={handleKeyDown}
                            placeholder={appliedFilters.length === 0 ? placeholder : ''}
                            className="min-w-[48px] flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100"
                        />
                    )}
                </div>
                {canScrollRight && (
                    <button
                        type="button"
                        onClick={() => scrollPillRow(1)}
                        className="flex h-5 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title="Scroll right"
                    >
                        <ChevronRightIcon />
                    </button>
                )}
                {/* Single clear-all control, replacing each pill's own remove button -
                    a pill click now edits it (see editFilter) rather than removing it,
                    so this is the one place left to drop every applied filter at once. */}
                {hasAppliedFilters && (
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        title="Clear all filters"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {showDropdown && (() => {
                const dropdownBody = (
                    <>
                    {showValueList && (
                        <div className="thin-scrollbar max-h-72 overflow-y-auto py-1">
                            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {pendingType.keyword}
                            </p>
                            {filteredOptions.length === 0 && (
                                <p className="px-3 py-1.5 text-sm text-gray-400 dark:text-gray-500">No matches</p>
                            )}
                            {filteredOptions.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => applyValue(pendingType, o.value)}
                                    className="flex w-full items-center px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {showTextPanel && (
                        <div className="thin-scrollbar max-h-80 overflow-y-auto py-1">
                            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                {pendingType.keyword}
                            </p>
                            {pendingKind === 'typed-text' && !pendingSubType && (
                                <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                                    {pendingType.types.map((t) => (
                                        <button
                                            key={t.value}
                                            type="button"
                                            onClick={() => setPendingSubType(t.value)}
                                            className="rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={applyPending}
                                disabled={!canApplyPending}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700"
                            >
                                <FilterTypeIcon />
                                <span>
                                    {canApplyPending
                                        ? `Press Enter to apply${pendingQuery ? ` - "${pendingQuery}"` : ''}`
                                        : `Type to search ${pendingType.keyword}`}
                                </span>
                            </button>
                        </div>
                    )}

                    {showKeywordSuggestions && (
                        <div>
                            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                                Filter by
                            </p>
                            {/* Category tabs sit above the list rather than as inline section
                                headers you have to scroll past - clicking one jumps straight
                                to that group instead of scanning past every other category. */}
                            {showCategoryTabs && (
                                <div className="flex items-center border-b border-gray-100 dark:border-gray-700">
                                    {canScrollTabsLeft && (
                                        <button
                                            type="button"
                                            onClick={() => scrollTabRow(-1)}
                                            className="flex h-6 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                            title="Scroll left"
                                        >
                                            <ChevronLeftIcon />
                                        </button>
                                    )}
                                    <div
                                        ref={tabRowRef}
                                        onScroll={handleTabRowScroll}
                                        className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-2 pb-2 pt-0.5"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => setActiveCategory(null)}
                                            className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                                effectiveCategory === null
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            All
                                        </button>
                                        {categoryOrder.map((cat) => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setActiveCategory(cat)}
                                                className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                                    effectiveCategory === cat
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                                }`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                    {canScrollTabsRight && (
                                        <button
                                            type="button"
                                            onClick={() => scrollTabRow(1)}
                                            className="flex h-6 w-4 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                            title="Scroll right"
                                        >
                                            <ChevronRightIcon />
                                        </button>
                                    )}
                                </div>
                            )}
                            <div className="thin-scrollbar max-h-72 overflow-y-auto p-2">
                                {effectiveCategory === null
                                    ? categoryOrder.map((cat) => (
                                          <div key={cat} className="mb-2 last:mb-0">
                                              <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                  {cat}
                                              </p>
                                              <div className="space-y-0.5">{categorized[cat].map(renderFilterTypeRow)}</div>
                                          </div>
                                      ))
                                    : (
                                          <div className="space-y-0.5">{categorized[effectiveCategory].map(renderFilterTypeRow)}</div>
                                      )}
                                {effectiveCategory === null && uncategorized.length > 0 && (
                                    <div className="space-y-0.5">{uncategorized.map(renderFilterTypeRow)}</div>
                                )}
                            </div>
                        </div>
                    )}
                    </>
                );

                return (
                    <>
                        {/* Mobile: fixed to the viewport and centered on screen (see mobileDropdownTop
                            above), capped to a viewport-relative width - since the bar itself can now
                            span most of the header width (see Projects/Show.jsx), anchoring to its own
                            edge no longer lands anywhere near the middle of the screen. */}
                        <div
                            className="fixed left-1/2 z-20 w-[min(92vw,22rem)] -translate-x-1/2 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:hidden"
                            style={{ top: mobileDropdownTop }}
                        >
                            {dropdownBody}
                        </div>
                        {/* Desktop: anchored to the bar's own right edge, and now sized to match
                            the bar's own width (w-full off this relative container) rather than a
                            fixed w-96 - the old fixed width was wider than some bars (e.g. Projects
                            Index's w-72 search bar), so it hung off past their left edge over
                            whatever sat beside/behind them. min-w guards the narrowest bars. */}
                        <div className="absolute right-0 top-full z-20 mt-1 hidden w-full min-w-[16rem] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:block">
                            {dropdownBody}
                        </div>
                    </>
                );
            })()}
        </div>
    );
}

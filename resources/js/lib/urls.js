// Finds http(s):// and www. links in plain text. Kept free of React so it can
// be reused (and tested) anywhere text needs to be split around links.

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>]+/gi;

// Punctuation that usually ends a sentence rather than the link itself.
const TRAILING = /[.,;:!?'"*_~\]}>)]$/;
const PAIRS = { ')': '(', ']': '[', '}': '{' };

function trimTrailing(url) {
    let end = url.length;

    while (end > 0) {
        const last = url[end - 1];
        if (!TRAILING.test(last)) break;

        // Keep a closing bracket when it balances one inside the link,
        // e.g. https://en.wikipedia.org/wiki/Laravel_(framework)
        if (PAIRS[last]) {
            const body = url.slice(0, end);
            const opens = body.split(PAIRS[last]).length - 1;
            const closes = body.split(last).length - 1;
            if (closes <= opens) break;
        }

        end -= 1;
    }

    return url.slice(0, end);
}

// Only ever produces http(s) hrefs, so text like "javascript:..." is never
// turned into a link.
export function toHref(url) {
    return /^www\./i.test(url) ? `https://${url}` : url;
}

// Splits text into [{ type: 'text' | 'link', value }] segments.
export function splitUrls(text) {
    if (!text) return [];

    const segments = [];
    let cursor = 0;

    for (const match of text.matchAll(URL_PATTERN)) {
        const start = match.index;
        // "foowww.example.com" is not a link, only a standalone www.
        if (start > 0 && /[\w@]/.test(text[start - 1]) && /^www\./i.test(match[0])) continue;

        const url = trimTrailing(match[0]);
        // Nothing after the scheme / "www." means nothing to link to.
        if (!url || /^(?:https?:\/\/|www\.)$/i.test(url)) continue;

        if (start > cursor) segments.push({ type: 'text', value: text.slice(cursor, start) });
        segments.push({ type: 'link', value: url });
        cursor = start + url.length;
    }

    if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });

    return segments;
}

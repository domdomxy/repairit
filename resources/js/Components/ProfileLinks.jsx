import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { Section } from '@/Components/ProfileParts';

// Links on a public profile: a website, social networks... Shown on the profile
// pages and in the messages panel, and edited on both profile edit pages.

// Names for the networks people usually link to, from the site's address. Any
// other address is a "Website" unless the person gave the link a label.
const PLATFORMS = [
    ['instagram.com', 'Instagram'],
    ['facebook.com', 'Facebook'],
    ['fb.com', 'Facebook'],
    ['twitter.com', 'X'],
    ['x.com', 'X'],
    ['linkedin.com', 'LinkedIn'],
    ['youtube.com', 'YouTube'],
    ['youtu.be', 'YouTube'],
    ['tiktok.com', 'TikTok'],
    ['github.com', 'GitHub'],
    ['wa.me', 'WhatsApp'],
    ['whatsapp.com', 'WhatsApp'],
    ['t.me', 'Telegram'],
    ['telegram.me', 'Telegram'],
    ['pinterest.com', 'Pinterest'],
    ['behance.net', 'Behance'],
];

function hostOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        return '';
    }
}

function platformOf(url) {
    const host = hostOf(url);
    const match = PLATFORMS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));

    return match ? match[1] : 'Website';
}

// The address as people read it: no "https://", no "www." and no trailing slash.
function displayUrl(url) {
    return url
        .replace(/^https?:\/\/(www\.)?/i, '')
        .replace(/\/+$/, '');
}

// Only web addresses become clickable links, whatever the server sent.
function isWebUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function GlobeIcon({ className = 'h-4 w-4' }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
        </svg>
    );
}

// The rows of links, styled like the contact rows. They open in a new tab.
export function LinkRows({ links }) {
    const shown = (links ?? []).filter((link) => isWebUrl(link.url));

    return (
        <div className="space-y-0.5">
            {shown.map((link, index) => (
                <a
                    key={`${link.url}-${index}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300">
                        <GlobeIcon />
                    </span>
                    <span className="min-w-0">
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {link.label || platformOf(link.url)}
                        </span>
                        <span className="block break-all text-sm font-medium text-gray-800 dark:text-gray-100">
                            {displayUrl(link.url)}
                        </span>
                    </span>
                </a>
            ))}
        </div>
    );
}

// The "Links" section of a profile's side panel; nothing when there are none.
export default function ProfileLinksSection({ links }) {
    if (!(links ?? []).some((link) => isWebUrl(link.url))) {
        return null;
    }

    return (
        <Section title="Links">
            <LinkRows links={links} />
        </Section>
    );
}

// The editor: one row per link (an optional label and the address), a button to
// add another one, and a button to remove each. `errors` are the form's errors,
// which name the rows like "links.0.url".
export function LinksEditor({ links, onChange, errors, max, labelMax, urlMax }) {
    function update(index, field, value) {
        onChange(links.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
    }

    function remove(index) {
        onChange(links.filter((_, i) => i !== index));
    }

    function add() {
        onChange([...links, { label: '', url: '' }]);
    }

    return (
        <div className="space-y-4">
            {links.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    No links yet. Add your website or your social networks.
                </p>
            )}

            {links.map((link, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <div>
                            <InputLabel htmlFor={`link-label-${index}`} value="Label (optional)" />
                            <TextInput
                                id={`link-label-${index}`}
                                className="mt-1 block w-full"
                                value={link.label ?? ''}
                                onChange={(e) => update(index, 'label', e.target.value)}
                                maxLength={labelMax}
                                placeholder="Instagram, My shop…"
                            />
                            <InputError message={errors?.[`links.${index}.label`]} className="mt-1" />
                        </div>

                        <div>
                            <InputLabel htmlFor={`link-url-${index}`} value="Web address" />
                            <TextInput
                                id={`link-url-${index}`}
                                className="mt-1 block w-full"
                                value={link.url ?? ''}
                                onChange={(e) => update(index, 'url', e.target.value)}
                                maxLength={urlMax}
                                inputMode="url"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="https://example.com"
                            />
                            <InputError message={errors?.[`links.${index}.url`]} className="mt-1" />
                        </div>
                    </div>

                    <div className="mt-2 text-right">
                        <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-sm text-red-600 hover:underline dark:text-red-400"
                        >
                            Remove link
                        </button>
                    </div>
                </div>
            ))}

            <InputError message={errors?.links} />

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={add}
                    disabled={links.length >= max}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50"
                >
                    + Add a link
                </button>

                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {links.length}/{max}
                </span>
            </div>
        </div>
    );
}

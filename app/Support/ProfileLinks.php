<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The links (a website, social networks...) customers and technicians can put
 * on their public profile: at most MAX of them, each with a web address and an
 * optional label. They are stored as JSON on the user: [{"label": ..., "url": ...}].
 *
 * Only http and https addresses are accepted, so a link can never run a script.
 */
class ProfileLinks
{
    /** Most links a profile can carry. */
    public const MAX = 6;

    public const LABEL_MAX = 40;

    public const URL_MAX = 255;

    /**
     * Tidy what the form sent before it is validated: rows left completely
     * empty are dropped, and an address typed without "https://" (like
     * "instagram.com/me") gets it.
     */
    public static function prepare(Request $request): void
    {
        $links = $request->input('links');

        if (! is_array($links)) {
            return;
        }

        $links = collect($links)
            ->filter(fn ($link) => is_array($link))
            ->map(function (array $link) {
                $url = trim((string) ($link['url'] ?? ''));
                $label = trim((string) ($link['label'] ?? ''));

                if ($url !== '' && ! preg_match('#^[a-z][a-z0-9+.\-]*://#i', $url)) {
                    $url = 'https://'.$url;
                }

                return ['label' => $label, 'url' => $url === 'https://' ? '' : $url];
            })
            ->reject(fn (array $link) => $link['url'] === '' && $link['label'] === '')
            ->values()
            ->all();

        $request->merge(['links' => $links]);
    }

    /** @return array<string, list<string>> */
    public static function rules(): array
    {
        return [
            'links' => ['nullable', 'array', 'max:'.self::MAX],
            'links.*' => ['array'],
            'links.*.label' => ['nullable', 'string', 'max:'.self::LABEL_MAX],
            'links.*.url' => ['required', 'string', 'max:'.self::URL_MAX, 'url:http,https'],
        ];
    }

    /** @return array<string, string> */
    public static function messages(): array
    {
        return [
            'links.max' => 'You can add up to '.self::MAX.' links.',
            'links.*.url.required' => 'Add the web address for this link.',
            'links.*.url.url' => 'Enter a valid web address, like https://example.com.',
            'links.*.url.max' => 'This web address is too long.',
            'links.*.label.max' => 'The label can have at most '.self::LABEL_MAX.' characters.',
        ];
    }

    /**
     * What is saved for validated input: a clean list, or null when there is
     * nothing to keep.
     *
     * @param  array<int, array<string, mixed>>  $links
     * @return list<array{label: string|null, url: string}>|null
     */
    public static function clean(array $links): ?array
    {
        $clean = collect($links)
            ->map(fn (array $link) => [
                'label' => filled($link['label'] ?? null) ? trim($link['label']) : null,
                'url' => trim($link['url']),
            ])
            ->values()
            ->all();

        return $clean === [] ? null : $clean;
    }

    /**
     * The links as the page shows them, whatever is stored.
     *
     * @return list<array{label: string|null, url: string}>
     */
    public static function list(mixed $links): array
    {
        return collect(is_array($links) ? $links : [])
            ->filter(fn ($link) => is_array($link) && is_string($link['url'] ?? null) && preg_match('#^https?://#i', $link['url']))
            ->map(fn (array $link) => [
                'label' => filled($link['label'] ?? null) ? $link['label'] : null,
                'url' => $link['url'],
            ])
            ->values()
            ->all();
    }
}

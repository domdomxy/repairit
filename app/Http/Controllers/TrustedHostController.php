<?php

namespace App\Http\Controllers;

use App\Events\TrustedHostsUpdated;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Backs the "Trust ... links from now on" checkbox in the "Leaving Repairit"
 * prompt (ExternalLinkGuard) and the Trusted sites tab in Settings. A plain
 * JSON API rather than Inertia pages: the prompt is mounted once, outside
 * Inertia's page swapping, so it asks this endpoint directly.
 *
 * The list lives on the account (users.trusted_link_hosts) and reaches the
 * browser as the shared `auth.trusted_hosts` prop, so there is no endpoint to
 * read it: every page visit already brings the current list.
 */
class TrustedHostController extends Controller
{
    /** Most sites one account can trust; a limit only so the list can't grow without end. */
    public const MAX = 200;

    public function store(Request $request, string $host): JsonResponse
    {
        $host = $this->normalize($host);

        abort_unless($this->isHost($host), 422, 'That is not a valid site address.');

        $user = $request->user();
        $hosts = $user->trusted_link_hosts ?? [];

        if (! in_array($host, $hosts, true)) {
            abort_if(count($hosts) >= self::MAX, 422, 'You can trust up to '.self::MAX.' sites. Remove some first.');

            $hosts[] = $host;
            $user->update(['trusted_link_hosts' => $hosts]);
            $this->broadcastHosts($user->id, $hosts);
        }

        return response()->json(['hosts' => $hosts]);
    }

    public function destroy(Request $request, string $host): JsonResponse
    {
        $host = $this->normalize($host);

        $user = $request->user();
        $hosts = array_values(array_diff($user->trusted_link_hosts ?? [], [$host]));

        $user->update(['trusted_link_hosts' => $hosts]);
        $this->broadcastHosts($user->id, $hosts);

        return response()->json(['hosts' => $hosts]);
    }

    public function destroyAll(Request $request): JsonResponse
    {
        $request->user()->update(['trusted_link_hosts' => []]);
        $this->broadcastHosts($request->user()->id, []);

        return response()->json(['hosts' => []]);
    }

    /** Host names are compared in lower case, without a trailing dot. */
    private function normalize(string $host): string
    {
        return rtrim(strtolower(trim($host)), '.');
    }

    /**
     * A host name as a browser reports it (URL.hostname): letters, digits and
     * hyphens in dot-separated labels (an international name arrives as its
     * "xn--" form), a bare IPv4 address, or an IPv6 address in brackets. Anything
     * else is not something a link can point at, so it is never stored.
     */
    private function isHost(string $host): bool
    {
        if ($host === '' || strlen($host) > 253) {
            return false;
        }

        if (preg_match('/^\[[0-9a-f:.]+\]$/', $host) === 1) {
            return true;
        }

        return preg_match('/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/', $host) === 1;
    }

    /**
     * Self-sync only: lets the person's other tabs and devices show the same list.
     * Best effort, since a broadcasting hiccup must not undo a saved change.
     */
    private function broadcastHosts(int $userId, array $hosts): void
    {
        try {
            broadcast(new TrustedHostsUpdated($userId, $hosts))->toOthers();
        } catch (\Throwable $e) {
            report($e);
        }
    }
}

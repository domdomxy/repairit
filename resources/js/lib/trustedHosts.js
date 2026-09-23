import axios from 'axios';

// The sites this person let open without the "Leaving Repairit" prompt.
//
// They are kept on the account (server side), not in the browser: a trusted
// site follows the person to every device and never carries over to another
// account that shares this browser. The server hands the list to every page as
// the shared `auth.trusted_hosts` prop, so this module never has to fetch it:
// the app seeds it from those props on load and on every visit (see
// ExternalLinkGuard), and every change made here is written to the account and
// then published to whoever is listening in this tab (the prompt and the
// Settings page). Other tabs and devices are kept in step by a broadcast
// (see TrustedHostsSyncListener).
//
// The requests go through axios, not fetch, so Echo can add this tab's socket
// id to them: the server then leaves this tab out of the broadcast it sends.

const CHANGE_EVENT = 'repairit:trusted-hosts-changed';

let cache = [];

function publish(hosts) {
    cache = Array.isArray(hosts) ? hosts : [];
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: cache }));
}

function url(host) {
    return `/trusted-hosts/${encodeURIComponent(host)}`;
}

/** Whatever is known right now. */
export function getTrustedHosts() {
    return cache;
}

/**
 * Replaces the list with one that came from the server: the page's own props,
 * or a change made on another tab or device.
 */
export function setTrustedHosts(hosts) {
    publish(hosts);
}

/**
 * Trusts a site for this account. Best effort: if the request fails the site
 * simply is not trusted, and the prompt asks again next time.
 */
export async function trustHost(host) {
    try {
        const { data } = await axios.put(url(host));
        publish(data.hosts);
    } catch {
        // see above
    }
}

export async function revokeTrustedHost(host) {
    const { data } = await axios.delete(url(host));
    publish(data.hosts);
}

export async function revokeAllTrustedHosts() {
    const { data } = await axios.delete('/trusted-hosts');
    publish(data.hosts);
}

/** Calls back whenever the list changes, from anywhere. Returns the way to stop. */
export function subscribeTrustedHosts(callback) {
    const handler = (event) => callback(event.detail ?? cache);

    window.addEventListener(CHANGE_EVENT, handler);

    return () => window.removeEventListener(CHANGE_EVENT, handler);
}

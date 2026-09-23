import ExternalLinkDialog from '@/Components/ExternalLinkDialog';
import { getTrustedHosts, setTrustedHosts, subscribeTrustedHosts, trustHost } from '@/lib/trustedHosts';
import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';

// Wraps the whole app (mounted once in app.jsx, outside Inertia's page
// switching) and stops every click on a link that would take the person off
// Repairit, to ask "Leaving Repairit?" before going.
//
// One capture-phase click handler on a wrapper around the app, rather than a
// fix at every place a link can appear: message text, posts, profile links and
// anything added later all render plain <a> elements, and this catches them all.
//
// "External" is an http(s) address whose host differs from this site's.
// Relative links, in-page anchors, mailto:/tel: and same-site links go straight
// through. So do ctrl/cmd/shift/middle-clicks: opening in a background tab is a
// deliberate gesture, not a plain click, and is not interrupted.
//
// A host the person ticked "Trust ... links from now on" for skips the prompt.
// The list is kept on their account (see lib/trustedHosts.js) and revoked from
// Settings. Someone who is not signed in is always asked, and is not offered
// the tick, since there is no account to remember it on.
//
// The list and the signed-in state are re-read from the page's shared props on
// every visit, so signing out and into another account in the same tab can
// never leave the first account's trusted sites behind.
export default function ExternalLinkGuard({ children, signedIn: initiallySignedIn }) {
    const [trustedHosts, setHosts] = useState(getTrustedHosts);
    const [signedIn, setSignedIn] = useState(initiallySignedIn);
    const [pending, setPending] = useState(null); // { url, target } | null
    const [trustChecked, setTrustChecked] = useState(false);

    useEffect(() => subscribeTrustedHosts(setHosts), []);

    useEffect(
        () =>
            router.on('navigate', (event) => {
                const auth = event.detail.page.props.auth;

                setSignedIn(!!auth?.user);
                setTrustedHosts(auth?.trusted_hosts ?? []);
            }),
        [],
    );

    function handleClick(event) {
        // Only plain left-clicks.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = event.target.closest?.('a[href]');
        if (!anchor) return;

        let url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch {
            return; // not an address, so there is nothing to check
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') return; // mailto:, tel:, ...
        if (url.hostname === window.location.hostname) return; // this site
        if (trustedHosts.includes(url.hostname)) return; // trusted: go straight there

        event.preventDefault();
        event.stopPropagation();

        setTrustChecked(false);
        setPending({ url, target: anchor.target || '_blank' });
    }

    function confirm() {
        if (pending) {
            const { hostname, href } = pending.url;

            if (signedIn && trustChecked && !trustedHosts.includes(hostname)) {
                // Trusted at once in this tab; the request saves it on the account.
                setHosts([...trustedHosts, hostname]);
                trustHost(hostname);
            }

            window.open(href, pending.target, 'noopener,noreferrer');
        }

        setPending(null);
    }

    return (
        // Capture phase, so this runs before any onClick (or stopPropagation)
        // on the link itself. display: contents keeps the wrapper out of the
        // layout, so it cannot break a page that expects to be a direct child of #app.
        <div onClickCapture={handleClick} style={{ display: 'contents' }}>
            {children}
            <ExternalLinkDialog
                open={!!pending}
                hostname={pending?.url.hostname}
                url={pending?.url.href}
                canTrust={signedIn}
                trustChecked={trustChecked}
                onTrustChange={setTrustChecked}
                onConfirm={confirm}
                onCancel={() => setPending(null)}
            />
        </div>
    );
}

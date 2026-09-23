import { setTrustedHosts } from '@/lib/trustedHosts';
import { useEcho } from '@laravel/echo-react';

// Keeps the trusted-sites list the same on every open tab and device: when it
// changes on one, the server sends the whole list to the others (see
// TrustedHostController and TrustedHostsUpdated), so a site revoked in one
// browser does not stay "trusted" in another until its next reload.
export default function TrustedHostsSyncListener({ userId }) {
    useEcho(`App.Models.User.${userId}`, '.trusted-hosts.updated', (event) => {
        setTrustedHosts(event.hosts ?? []);
    });

    return null;
}

import '../css/app.css';
import '../css/dark-theme.css';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import ExternalLinkGuard from './Components/ExternalLinkGuard';
import { setTrustedHosts } from './lib/trustedHosts';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);
        const auth = props.initialPage.props.auth;

        // The first page already carries this account's trusted sites; later
        // visits refresh them (see ExternalLinkGuard).
        setTrustedHosts(auth?.trusted_hosts ?? []);

        root.render(
            <ExternalLinkGuard signedIn={!!auth?.user}>
                <App {...props} />
            </ExternalLinkGuard>,
        );
    },
    progress: {
        color: '#4B5563',
    },
});

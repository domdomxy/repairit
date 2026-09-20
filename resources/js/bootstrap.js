import axios from 'axios';
import { configureEcho } from '@laravel/echo-react';

// Echo's own request interceptor (registered below, via configureEcho) only
// wires itself up to a *global* `axios`, so that its "X-Socket-Id" header
// reaches every request this tab makes, including Inertia's own. Without
// this, the server can't tell which browser tab sent a message, so
// `broadcast(...)->toOthers()` has no "other" to exclude and echoes new
// messages back to their own sender: they'd show once from the page's own
// reload and a second time from the socket, until the page was refreshed.
window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

configureEcho({
    broadcaster: 'reverb',
});

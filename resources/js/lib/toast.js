// The toasts of the app. Pages do not render them: they call `toast.success('Saved.')`
// (or `.error`, `.warning`, `.info`), and the <Toaster /> mounted in app.jsx shows them.
// The messages the server flashes after a redirect arrive the same way (see Toaster.jsx).

const listeners = new Set();
let counter = 0;

export function subscribeToasts(listener) {
    listeners.add(listener);

    return () => listeners.delete(listener);
}

function push(type, message, options = {}) {
    if (typeof message !== 'string' || message === '') {
        return;
    }

    counter += 1;
    listeners.forEach((listener) => listener({ id: counter, type, message, ...options }));
}

export const toast = {
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    warning: (message, options) => push('warning', message, options),
    info: (message, options) => push('info', message, options),
};

import { Link, router, usePage } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { Component } from 'react';

// Refreshes the unread count (and the list, when it is on screen) whenever the
// server pushes a notification for this user.
function LiveUpdates({ userId }) {
    useEchoNotification(`App.Models.User.${userId}`, () => {
        router.reload({ only: ['notifications', 'items', 'ticket', 'thread'] });
    });

    return null;
}

// The bell must keep working even if websockets are not configured (Echo throws
// when its Reverb settings are missing), so a failure here is contained rather
// than taking down every page that uses the layout.
class LiveUpdatesBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default function NotificationBell({ className = '' }) {
    const { auth, notifications } = usePage().props;
    const unread = notifications?.unread ?? 0;

    return (
        <>
            <Link
                href={route('notifications.index')}
                className={`relative inline-flex items-center rounded-md p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ${className}`}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
                    />
                </svg>
                {unread > 0 && (
                    <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Link>

            <LiveUpdatesBoundary>
                <LiveUpdates userId={auth.user.id} />
            </LiveUpdatesBoundary>
        </>
    );
}

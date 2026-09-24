import { CheckIcon, ErrorCircleIcon, InfoIcon, WarningIcon, XIcon } from '@/Components/Icons';
import { subscribeToasts, toast } from '@/lib/toast';
import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// How each kind looks, and how long it stays (the ones that need reading stay longer).
const KINDS = {
    success: { icon: CheckIcon, color: 'bg-[#0e7355]', duration: 4000 },
    info: { icon: InfoIcon, color: 'bg-[#0057b8]', duration: 5000 },
    warning: { icon: WarningIcon, color: 'bg-[#9a5600]', duration: 6000 },
    error: { icon: ErrorCircleIcon, color: 'bg-[#c41e3a]', duration: 8000 },
};

// At most this many at once: a new one pushes the oldest out.
const MAX_VISIBLE = 4;

const LEAVE_MS = 180;

function Toast({ item, onClose }) {
    const kind = KINDS[item.type] ?? KINDS.info;
    const Icon = kind.icon;
    const [leaving, setLeaving] = useState(false);
    const timer = useRef(null);

    useEffect(() => () => clearTimeout(timer.current), []);

    function close() {
        if (leaving) {
            return;
        }

        setLeaving(true);
        timer.current = setTimeout(() => onClose(item.id), LEAVE_MS);
    }

    return (
        <div
            role={item.type === 'error' ? 'alert' : 'status'}
            // Hovering or focusing a toast pauses its bar (and so its timer), so it can be read at leisure.
            className={`group pointer-events-auto relative w-full overflow-hidden rounded-lg text-white shadow-lg shadow-black/30 ${kind.color} ${
                leaving ? 'toast-out' : 'toast-in'
            }`}
        >
            <div className="flex items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 shrink-0" />
                <p className="min-w-0 flex-1 break-words text-sm font-medium leading-snug">{item.message}</p>
                <button
                    type="button"
                    onClick={close}
                    aria-label="Dismiss"
                    className="-me-1 shrink-0 rounded p-0.5 text-white/80 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </div>

            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-black/15">
                <div
                    className="toast-bar h-full bg-white/60 group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]"
                    style={{ animationDuration: `${item.duration ?? kind.duration}ms` }}
                    onAnimationEnd={close}
                />
            </div>
        </div>
    );
}

// Turns what the server flashed after an action ("Update posted.") and what the page
// pushes through `toast` into the stack of toasts at the bottom right of the screen. It lives
// outside the pages (see app.jsx), so every layout gets it and it survives navigation.
export default function Toaster({ initialFlash = null }) {
    const [items, setItems] = useState([]);
    const seen = useRef(null);

    useEffect(() => {
        const add = (item) => setItems((current) => [...current, item].slice(-MAX_VISIBLE));

        // A flash is shown once: the id is new on every response that carries one.
        function show(flash) {
            if (!flash?.id || flash.id === seen.current) {
                return;
            }

            seen.current = flash.id;

            for (const type of Object.keys(KINDS)) {
                if (flash[type]) {
                    toast[type](flash[type]);
                }
            }
        }

        const unsubscribe = subscribeToasts(add);
        const removeListener = router.on('success', (event) => show(event.detail.page.props.flash));

        // Subscribed first, so the message flashed for the very first page is not missed.
        show(initialFlash);

        return () => {
            unsubscribe();
            removeListener();
        };
    }, []);

    if (items.length === 0) {
        return null;
    }

    return (
        <div
            aria-label="Notifications"
            className="pointer-events-none fixed bottom-4 end-4 z-[100] flex w-[calc(100%-2rem)] max-w-xs flex-col items-end gap-2"
        >
            {items.map((item) => (
                <Toast key={item.id} item={item} onClose={(id) => setItems((current) => current.filter((t) => t.id !== id))} />
            ))}
        </div>
    );
}

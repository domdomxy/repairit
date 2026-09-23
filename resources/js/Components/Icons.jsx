// Small outline icons shared by the profile and messages panels. They inherit
// the text colour (currentColor) and are sized with `className`.
const outline = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
};

export function PinIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
        </svg>
    );
}

// A thumbtack, for pinning a conversation - distinct from PinIcon (a map pin,
// used for locations and addresses).
export function PushpinIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M12 17v5" />
            <path d="M9 3h6l-.6 5.4a2 2 0 0 0 .77 1.83L17 11.5a1 1 0 0 1 .38 1.7l-1.13 1.13a1 1 0 0 1-.71.29H8.46a1 1 0 0 1-.71-.29L6.62 13.2a1 1 0 0 1 .38-1.7l1.83-1.27A2 2 0 0 0 9.6 8.4L9 3Z" />
        </svg>
    );
}

export function PhoneIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
    );
}

export function MailIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
        </svg>
    );
}

export function ChatIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M21 12a8 8 0 0 1-11.6 7.14L4 20l1-4.3A8 8 0 1 1 21 12Z" />
        </svg>
    );
}

export function PencilIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
        </svg>
    );
}

// Filled, so it can be tinted amber (rated) or gray (not rated).
export function StarIcon({ className = 'h-4 w-4' }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            <path d="m12 2.5 2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5Z" />
        </svg>
    );
}

export function DashboardIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
    );
}

export function DocumentIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" />
        </svg>
    );
}

export function WrenchIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
        </svg>
    );
}

export function PlusIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M12 5v14M5 12h14" />
        </svg>
    );
}

export function TagIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.41l8.7 8.71a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42Z" />
            <circle cx="7.5" cy="7.5" r="1" fill="currentColor" />
        </svg>
    );
}

export function LifebuoyIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24" />
        </svg>
    );
}

export function ChevronRightIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} className={className}>
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

export function XIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <path d="M18 6 6 18M6 6l12 12" />
        </svg>
    );
}

export function CheckIcon({ className = 'h-4 w-4' }) {
    return (
        <svg {...outline} strokeWidth={2.4} className={className}>
            <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
    );
}

export function SmileyIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <circle cx="12" cy="12" r="9" />
            <path d="M8.5 10.5h.01M15.5 10.5h.01" strokeLinecap="round" />
            <path d="M8.5 14.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" strokeLinecap="round" />
        </svg>
    );
}

export function ImageIcon({ className = 'h-5 w-5' }) {
    return (
        <svg {...outline} className={className}>
            <rect x="3" y="3" width="18" height="18" rx="2.5" />
            <circle cx="9" cy="9" r="1.6" />
            <path d="m21 15-4.6-4.6a1.5 1.5 0 0 0-2.1 0L5 19.5" />
        </svg>
    );
}

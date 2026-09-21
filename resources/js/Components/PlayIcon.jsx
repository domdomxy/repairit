// A real play button (a dark disc with a triangle) for clips, instead of a
// text glyph that the OS may draw as a coloured emoji. Size it with `className`
// (e.g. "h-12 w-12"); the triangle scales with the disc.
export default function PlayIcon({ className = 'h-12 w-12' }) {
    return (
        <span
            aria-hidden="true"
            className={`flex items-center justify-center rounded-full bg-black/60 text-white shadow ring-1 ring-white/30 ${className}`}
        >
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-[6%] h-1/2 w-1/2">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
            </svg>
        </span>
    );
}

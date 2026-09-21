// The point on the map a message shares: a small embedded map that opens
// full-size (in the device's own maps app) when tapped. No API key is needed
// since the preview uses OpenStreetMap's public embed.
export default function SharedLocationCard({ location, onImageLoad }) {
    const { lat, lng, label, maps_url: mapsUrl } = location;

    // A small box around the point, so the embed zooms to street level.
    const delta = 0.006;
    const bbox = `${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}`;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

    return (
        <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-64 max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow dark:border-gray-700 dark:bg-gray-800"
        >
            <div className="pointer-events-none h-32 w-full bg-gray-100 dark:bg-gray-900">
                <iframe
                    title="Shared location"
                    src={embedUrl}
                    className="h-full w-full border-0"
                    loading="lazy"
                    onLoad={onImageLoad}
                />
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
                <span aria-hidden="true" className="text-lg">📍</span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                        {label ?? 'Current location'}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {lat.toFixed(5)}, {lng.toFixed(5)} · Open in Maps
                    </span>
                </span>
            </div>
        </a>
    );
}

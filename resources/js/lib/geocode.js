// Address search for the technician search page, on OpenStreetMap's Nominatim
// (the same service the location picker on the profile form uses).
// Resolves to { lat, lng } of the best match, or null when nothing matches.
export async function findPlace(query) {
    const params = new URLSearchParams({ format: 'jsonv2', q: query.trim(), limit: '1', 'accept-language': 'en' });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);

    if (!response.ok) {
        throw new Error(`Nominatim responded with ${response.status}`);
    }

    const [best] = await response.json();

    return best ? { lat: parseFloat(best.lat), lng: parseFloat(best.lon) } : null;
}

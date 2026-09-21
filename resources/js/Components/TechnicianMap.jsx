import { router } from '@inertiajs/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

const DEFAULT_CENTER = [33.8869, 9.5375];
const DEFAULT_ZOOM = 6;

// A coloured dot per availability, like the badges on the result cards. Full
// class names on purpose: Tailwind only keeps classes it can read in the source.
const DOT_COLORS = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-gray-400',
};

function dotIcon(status) {
    return L.divIcon({
        className: '',
        html: `<span class="block h-4 w-4 rounded-full border-2 border-white shadow ${DOT_COLORS[status] ?? DOT_COLORS.offline}"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
    });
}

// The searcher's own spot: a bigger blue dot, so it is easy to grab and drag.
const originIcon = L.divIcon({
    className: '',
    html: '<span class="block h-5 w-5 rounded-full border-2 border-white bg-indigo-600 shadow-lg"></span>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

const round = (value) => Number(value.toFixed(7));

// Built from DOM nodes with textContent, so a name or city can never inject markup.
function popupFor(point) {
    const box = document.createElement('div');
    box.className = 'text-sm';

    const link = document.createElement('a');
    link.href = route('technicians.show', point.id);
    link.textContent = point.name;
    link.className = 'font-semibold';
    // Stay inside the app instead of reloading the whole page.
    link.addEventListener('click', (event) => {
        event.preventDefault();
        router.visit(link.href);
    });
    box.appendChild(link);

    const details = [
        point.city,
        point.availability_status,
        `★ ${point.rating_avg ?? '—'} (${point.rating_count})`,
    ].filter(Boolean);

    const line = document.createElement('div');
    line.className = 'capitalize';
    line.textContent = details.join(' · ');
    box.appendChild(line);

    return box;
}

/**
 * The technicians a search matches, on a map. The points are already rounded by
 * the server (about 1 km), so they mark a neighbourhood, not an address.
 *
 * `origin` ({ lat, lng }) is the searcher's own location when they set one,
 * shown with the search radius (`radiusKm`) around it.
 *
 * With `onPick(lat, lng)` the searcher can also set that location by hand, for
 * when the browser's is off: clicking the map puts it there, and its dot can be
 * dragged. The map then stays where the person left it instead of re-framing.
 */
export default function TechnicianMap({ points, origin = null, radiusKm = null, onPick = null, className = '' }) {
    const element = useRef(null);
    const map = useRef(null);
    const layer = useRef(null);
    const onPickRef = useRef(onPick);
    // The last spot chosen on this map, so the map can tell its own picks from a new location.
    const picked = useRef(null);

    onPickRef.current = onPick;

    function pick(lat, lng) {
        picked.current = { lat: round(lat), lng: round(lng) };
        onPickRef.current?.(picked.current.lat, picked.current.lng);
    }

    useEffect(() => {
        map.current = L.map(element.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        // Two base maps to switch between (the control in the corner): the street
        // map, and satellite photos with place names on top (a "hybrid" view).
        const streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });

        const esriAttribution = 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
        const photos = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19, attribution: esriAttribution },
        );
        const names = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            { maxZoom: 19 },
        );
        const satellite = L.layerGroup([photos, names]);

        streets.addTo(map.current);
        L.control.layers({ Map: streets, Satellite: satellite }, null, { position: 'topright', collapsed: true }).addTo(map.current);

        layer.current = L.layerGroup().addTo(map.current);

        map.current.on('click', (event) => {
            if (onPickRef.current) pick(event.latlng.lat, event.latlng.lng);
        });

        return () => {
            map.current.remove();
            map.current = null;
        };
    }, []);

    // Redrawn whenever a new search brings new results.
    useEffect(() => {
        layer.current.clearLayers();

        const bounds = [];

        points.forEach((point) => {
            L.marker([point.lat, point.lng], { icon: dotIcon(point.availability_status), title: point.name })
                .bindPopup(popupFor(point))
                .addTo(layer.current);
            bounds.push([point.lat, point.lng]);
        });

        if (origin) {
            const here = [origin.lat, origin.lng];

            const dot = L.marker(here, {
                icon: originIcon,
                draggable: Boolean(onPick),
                zIndexOffset: 1000,
                title: 'Your location',
            }).addTo(layer.current);

            dot.bindTooltip(onPick ? 'Your location: drag to move' : 'Your location');
            dot.on('dragend', () => {
                const { lat, lng } = dot.getLatLng();

                pick(lat, lng);
            });

            if (radiusKm) {
                const circle = L.circle(here, { radius: radiusKm * 1000, color: '#4f46e5', weight: 1, fillOpacity: 0.05 }).addTo(
                    layer.current,
                );
                bounds.push(circle.getBounds().getNorthEast(), circle.getBounds().getSouthWest());
            } else {
                bounds.push(here);
            }
        }

        // A spot the person just picked here is where they are looking already.
        const pickedHere =
            origin !== null &&
            picked.current !== null &&
            picked.current.lat === origin.lat &&
            picked.current.lng === origin.lng;

        if (!pickedHere) picked.current = null;

        if (bounds.length > 0 && !pickedHere) {
            map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }, [points, origin?.lat, origin?.lng, radiusKm]);

    return <div ref={element} className={`z-0 ${className}`} />;
}

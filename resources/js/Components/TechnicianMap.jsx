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
 */
export default function TechnicianMap({ points, origin = null, radiusKm = null, className = '' }) {
    const element = useRef(null);
    const map = useRef(null);
    const layer = useRef(null);

    useEffect(() => {
        map.current = L.map(element.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current);

        layer.current = L.layerGroup().addTo(map.current);

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

            L.circleMarker(here, { radius: 7, color: '#4f46e5', fillColor: '#4f46e5', fillOpacity: 1 })
                .bindTooltip('Your location')
                .addTo(layer.current);

            if (radiusKm) {
                const circle = L.circle(here, { radius: radiusKm * 1000, color: '#4f46e5', weight: 1, fillOpacity: 0.05 }).addTo(
                    layer.current,
                );
                bounds.push(circle.getBounds().getNorthEast(), circle.getBounds().getSouthWest());
            } else {
                bounds.push(here);
            }
        }

        if (bounds.length > 0) {
            map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
        }
    }, [points, origin?.lat, origin?.lng, radiusKm]);

    return <div ref={element} className={`z-0 ${className}`} />;
}

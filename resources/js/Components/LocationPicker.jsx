import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_CENTER = [33.8869, 9.5375];
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 15;

// Leaflet's default icon paths break under bundlers, so build the icon explicitly.
const pinIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function round(value) {
    return Number(value.toFixed(7));
}

function cityFrom(address = {}) {
    return (
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.county ||
        ''
    );
}

async function nominatim(endpoint, params) {
    const query = new URLSearchParams({
        format: 'jsonv2',
        addressdetails: 1,
        'accept-language': 'en',
        ...params,
    });

    const response = await fetch(`${NOMINATIM_URL}/${endpoint}?${query}`);

    if (!response.ok) {
        throw new Error(`Nominatim responded with ${response.status}`);
    }

    return response.json();
}

/**
 * Address search + draggable map pin.
 *
 * Reports changes through onChange(fields), where fields is any subset of
 * { address, city, latitude, longitude }. The parent owns the values.
 */
export default function LocationPicker({
    address,
    latitude,
    longitude,
    errors = {},
    autoLocate = false,
    hint = 'Click the map or drag the pin to fine-tune your position. Customers who search by distance find you through this pin.',
    onChange,
}) {
    const mapElement = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);
    const fromMap = useRef(null);
    const lookupId = useRef(0);
    const onChangeRef = useRef(onChange);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    onChangeRef.current = onChange;

    const hasPin = latitude !== null && longitude !== null;

    // A click or drag already put the pin where the user wants it, so the
    // map must not re-centre or zoom afterwards.
    function choosePoint(lat, lng) {
        const point = { latitude: round(lat), longitude: round(lng) };

        fromMap.current = point;
        onChangeRef.current(point);
        reverseLookup(point.latitude, point.longitude);
    }

    async function reverseLookup(lat, lng) {
        const id = ++lookupId.current;

        setBusy(true);
        setMessage('');

        try {
            const result = await nominatim('reverse', { lat, lon: lng, zoom: 18 });

            if (id !== lookupId.current) return;
            if (result.error) throw new Error(result.error);

            const city = cityFrom(result.address);

            onChangeRef.current({
                address: result.display_name,
                ...(city ? { city } : {}),
            });
        } catch {
            if (id === lookupId.current) {
                setMessage("Couldn't find an address for that spot. You can type it in manually.");
            }
        } finally {
            if (id === lookupId.current) setBusy(false);
        }
    }

    async function findAddress() {
        const query = (address ?? '').trim();

        if (!query) return;

        const id = ++lookupId.current;

        setBusy(true);
        setMessage('');

        try {
            const results = await nominatim('search', { q: query, limit: 1 });

            if (id !== lookupId.current) return;

            if (results.length === 0) {
                setMessage('No match found. Try adding the city, or click the map to drop a pin.');
                return;
            }

            const [best] = results;
            const city = cityFrom(best.address);

            onChangeRef.current({
                latitude: round(parseFloat(best.lat)),
                longitude: round(parseFloat(best.lon)),
                ...(city ? { city } : {}),
            });
        } catch {
            if (id === lookupId.current) {
                setMessage("Couldn't reach the address search. Try again in a moment, or click the map.");
            }
        } finally {
            if (id === lookupId.current) setBusy(false);
        }
    }

    function locateMe() {
        if (!navigator.geolocation) {
            setMessage('Your browser does not support geolocation.');
            return;
        }

        setBusy(true);
        setMessage('');

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const point = {
                    latitude: round(coords.latitude),
                    longitude: round(coords.longitude),
                };

                onChangeRef.current(point);
                reverseLookup(point.latitude, point.longitude);
            },
            () => {
                setBusy(false);
                setMessage("Couldn't get your location. Check your browser's location permission.");
            }
        );
    }

    function removePin() {
        lookupId.current++;
        setBusy(false);
        setMessage('');
        onChangeRef.current({ latitude: null, longitude: null });
    }

    // Create the map once.
    useEffect(() => {
        const center = hasPin ? [latitude, longitude] : DEFAULT_CENTER;

        map.current = L.map(mapElement.current).setView(
            center,
            hasPin ? PIN_ZOOM : DEFAULT_ZOOM
        );

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current);

        map.current.on('click', (event) => {
            choosePoint(event.latlng.lat, event.latlng.lng);
        });

        // Inside a modal the box can still be animating in when the map is
        // built, so let Leaflet re-measure once it has settled.
        const resize = setTimeout(() => map.current?.invalidateSize(), 350);

        return () => {
            clearTimeout(resize);
            map.current.remove();
            map.current = null;
            marker.current = null;
        };
    }, []);

    // Optionally start from where the device says it is.
    useEffect(() => {
        if (autoLocate && !hasPin) locateMe();
    }, []);

    // Keep the pin in step with the coordinates held by the form.
    useEffect(() => {
        if (!map.current) return;

        if (!hasPin) {
            marker.current?.remove();
            marker.current = null;
            return;
        }

        const position = L.latLng(latitude, longitude);

        if (!marker.current) {
            marker.current = L.marker(position, {
                icon: pinIcon,
                draggable: true,
            }).addTo(map.current);

            marker.current.on('dragend', () => {
                const { lat, lng } = marker.current.getLatLng();

                choosePoint(lat, lng);
            });
        } else if (!marker.current.getLatLng().equals(position, 1e-7)) {
            marker.current.setLatLng(position);
        }

        const movedByUser =
            fromMap.current?.latitude === latitude &&
            fromMap.current?.longitude === longitude;

        fromMap.current = null;

        if (!movedByUser) {
            map.current.setView(position, Math.max(map.current.getZoom(), PIN_ZOOM));
        }
    }, [latitude, longitude]);

    return (
        <div>
            <InputLabel htmlFor="address" value="Address" />

            <div className="mt-1 flex gap-2">
                <TextInput
                    id="address"
                    className="block w-full"
                    value={address ?? ''}
                    onChange={(e) => onChange({ address: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            findAddress();
                        }
                    }}
                    placeholder="Street, neighbourhood, city"
                    autoComplete="street-address"
                />

                <SecondaryButton
                    type="button"
                    onClick={findAddress}
                    disabled={busy || !(address ?? '').trim()}
                    className="shrink-0"
                >
                    Find on map
                </SecondaryButton>
            </div>

            <InputError message={errors.address} className="mt-2" />

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <button
                    type="button"
                    onClick={locateMe}
                    className="text-indigo-600 underline dark:text-indigo-400"
                >
                    Use my current location
                </button>

                {hasPin && (
                    <button
                        type="button"
                        onClick={removePin}
                        className="text-gray-600 underline dark:text-gray-400"
                    >
                        Remove pin
                    </button>
                )}

                {busy && (
                    <span className="text-gray-500 dark:text-gray-400">Looking up…</span>
                )}
            </div>

            {message && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{message}</p>
            )}

            <div
                ref={mapElement}
                className="relative z-0 mt-3 h-72 w-full overflow-hidden rounded-md border border-gray-300 dark:border-gray-700"
            />

            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {hint}
            </p>

            <InputError message={errors.latitude || errors.longitude} className="mt-2" />
        </div>
    );
}

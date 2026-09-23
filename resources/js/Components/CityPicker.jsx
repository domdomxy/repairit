import { PinIcon, XIcon } from '@/Components/Icons';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import { cityFrom, nominatim, pinIcon } from '@/Components/LocationPicker';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = [33.8869, 9.5375];
const DEFAULT_ZOOM = 6;
const PLACE_ZOOM = 11;

// The name to keep for a place: its city, or the region when it has none.
function placeName(address = {}, fallback = '') {
    return cityFrom(address) || address.state || fallback || '';
}

// A small map to click a city on, with a search box to find it by name. It reports
// the name of the place through `onPick`. Only mounted while the map is asked for,
// so the map is built when it opens and dropped when it closes.
function MapChooser({ onPick }) {
    const mapElement = useRef(null);
    const map = useRef(null);
    const marker = useRef(null);
    const lookupId = useRef(0);
    const onPickRef = useRef(onPick);
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');

    onPickRef.current = onPick;

    function drop(lat, lng, zoom = null) {
        const position = L.latLng(lat, lng);

        if (marker.current) {
            marker.current.setLatLng(position);
        } else {
            marker.current = L.marker(position, { icon: pinIcon }).addTo(map.current);
        }

        if (zoom) map.current.setView(position, zoom);
    }

    // A click on the map: the pin goes there and the place under it is looked up.
    async function pickPoint(lat, lng) {
        const id = ++lookupId.current;

        drop(lat, lng);
        setBusy(true);
        setMessage('');

        try {
            const result = await nominatim('reverse', { lat, lon: lng, zoom: 10 });

            if (id !== lookupId.current) return;

            const name = result.error ? '' : placeName(result.address, result.name);

            if (name) {
                onPickRef.current(name);
            } else {
                setMessage("Couldn't find a city there. Try another spot, or search for it.");
            }
        } catch {
            if (id === lookupId.current) setMessage("Couldn't reach the map search. Try again in a moment.");
        } finally {
            if (id === lookupId.current) setBusy(false);
        }
    }

    async function find() {
        const text = query.trim();

        if (!text) return;

        const id = ++lookupId.current;

        setBusy(true);
        setMessage('');

        try {
            const results = await nominatim('search', { q: text, limit: 1 });

            if (id !== lookupId.current) return;

            if (results.length === 0) {
                setMessage('No match found. Try another name, or click the map.');
                return;
            }

            const [best] = results;

            drop(parseFloat(best.lat), parseFloat(best.lon), PLACE_ZOOM);
            onPickRef.current(placeName(best.address, best.name) || text);
        } catch {
            if (id === lookupId.current) setMessage("Couldn't reach the map search. Try again in a moment.");
        } finally {
            if (id === lookupId.current) setBusy(false);
        }
    }

    useEffect(() => {
        map.current = L.map(mapElement.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map.current);

        map.current.on('click', (event) => pickPoint(event.latlng.lat, event.latlng.lng));

        // Inside a panel that is still animating in, the box is measured too early.
        const resize = setTimeout(() => map.current?.invalidateSize(), 350);

        return () => {
            clearTimeout(resize);
            map.current.remove();
            map.current = null;
            marker.current = null;
        };
    }, []);

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <TextInput
                    className="block min-w-0 flex-1 text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                        // Enter searches; it must not save the post.
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            find();
                        }
                    }}
                    placeholder="Search for a city or a place"
                    aria-label="Search for a city or a place"
                />
                <SecondaryButton onClick={find} disabled={busy || !query.trim()} className="shrink-0">
                    Find
                </SecondaryButton>
            </div>

            <div
                ref={mapElement}
                className="relative isolate z-0 h-44 w-full overflow-hidden rounded-lg border border-gray-300 dark:border-gray-700"
            />

            <p className="text-xs text-gray-500 dark:text-gray-400">
                {busy ? 'Looking up…' : 'Click the map to choose the city.'}
            </p>

            {message && <p className="text-xs text-amber-600 dark:text-amber-400">{message}</p>}
        </div>
    );
}

const CHOICE =
    'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';
const CHOICE_ON = 'border-indigo-600 bg-indigo-600 text-white shadow-sm';
const CHOICE_OFF =
    'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-indigo-900/20';

// The city of a post, chosen rather than typed: the city of the person's own
// profile ("My city"), or one clicked on a map. Nothing chosen is fine too, the
// city is optional. `value` is the city's name and `onChange` gets the new one.
export default function CityPicker({ value, onChange, myCity = null, maxLength = 100, error, label = 'City (optional)' }) {
    // Where the current city came from decides what is open.
    const [mode, setMode] = useState(() => (value && value === myCity ? 'mine' : value ? 'map' : null));

    const clip = (name) => name.slice(0, maxLength);

    function toggleMine() {
        if (mode === 'mine') {
            setMode(null);
            onChange('');
        } else {
            setMode('mine');
            onChange(clip(myCity));
        }
    }

    return (
        <div>
            <InputLabel value={label} />

            <div className="mt-1 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={toggleMine}
                    disabled={!myCity}
                    aria-pressed={mode === 'mine'}
                    title={myCity ? undefined : 'Add your city to your profile to use it here'}
                    className={`${CHOICE} ${mode === 'mine' ? CHOICE_ON : CHOICE_OFF}`}
                >
                    <PinIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{myCity ? `My city · ${myCity}` : 'My city'}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setMode(mode === 'map' ? null : 'map')}
                    aria-pressed={mode === 'map'}
                    className={`${CHOICE} ${mode === 'map' ? CHOICE_ON : CHOICE_OFF}`}
                >
                    Choose on the map
                </button>

                {value && mode !== 'mine' && (
                    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-gray-100 py-1 pe-1 ps-3 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                        <span className="truncate">{value}</span>
                        <button
                            type="button"
                            onClick={() => onChange('')}
                            aria-label="Remove the city"
                            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                        >
                            <XIcon className="h-3.5 w-3.5" />
                        </button>
                    </span>
                )}
            </div>

            {mode === 'map' && (
                <div className="mt-2">
                    <MapChooser onPick={(name) => onChange(clip(name))} />
                </div>
            )}

            <InputError message={error} className="mt-1" />
        </div>
    );
}

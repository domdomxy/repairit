import { useEffect, useState } from 'react';
import LocationPicker from '@/Components/LocationPicker';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

// Lets someone pick the exact spot to send in a chat (search an address, use
// their device, click the map or drag the pin) instead of trusting whatever
// the browser guessed. Calls onSend({ lat, lng, label }) with the chosen point.
export default function SendLocationModal({ show, sending = false, error = null, onClose, onSend }) {
    const [spot, setSpot] = useState({ address: '', latitude: null, longitude: null });

    // Start from a clean map every time it is opened.
    useEffect(() => {
        if (show) setSpot({ address: '', latitude: null, longitude: null });
    }, [show]);

    const hasPin = spot.latitude !== null && spot.longitude !== null;

    return (
        <Modal show={show} onClose={onClose} maxWidth="xl">
            <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Send your location</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    This is where your device says you are. If it's right, send it. If not, search for an address, click the map or drag the pin to correct it first.
                </p>

                <div className="mt-4">
                    <LocationPicker
                        address={spot.address}
                        latitude={spot.latitude}
                        longitude={spot.longitude}
                        autoLocate
                        hint="The pin is what gets sent."
                        onChange={(fields) => setSpot((current) => ({ ...current, ...fields }))}
                    />
                </div>

                {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                    <PrimaryButton
                        type="button"
                        disabled={!hasPin || sending}
                        onClick={() =>
                            onSend({
                                lat: spot.latitude,
                                lng: spot.longitude,
                                label: spot.address ? spot.address.slice(0, 120) : null,
                            })
                        }
                    >
                        {sending ? 'Sending…' : 'Send location'}
                    </PrimaryButton>
                </div>
            </div>
        </Modal>
    );
}

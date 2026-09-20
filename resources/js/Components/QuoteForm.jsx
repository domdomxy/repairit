import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { useForm } from '@inertiajs/react';

// A technician's quote for a repair request: what they would charge, how long
// it would take, and a note. Sending again changes the quote already sent.
export default function QuoteForm({ requestId, quote = null, limits, onDone, onCancel }) {
    const { data, setData, post, processing, errors } = useForm({
        price: quote?.price ?? '',
        estimated_time: quote?.estimated_time ?? '',
        message: quote?.message ?? '',
    });

    function submit(e) {
        e.preventDefault();

        post(route('requests.quotes.store', requestId), { preserveScroll: true, onSuccess: () => onDone?.() });
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div>
                    <InputLabel htmlFor="quote-price" value="Your price" />
                    <TextInput
                        id="quote-price"
                        className="mt-1 block w-full"
                        value={data.price}
                        onChange={(e) => setData('price', e.target.value)}
                        maxLength={limits.price_max}
                        placeholder="e.g. 80 TND"
                        required
                    />
                    <InputError message={errors.price} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="quote-time" value="How long it takes (optional)" />
                    <TextInput
                        id="quote-time"
                        className="mt-1 block w-full"
                        value={data.estimated_time}
                        onChange={(e) => setData('estimated_time', e.target.value)}
                        maxLength={limits.time_max}
                        placeholder="e.g. 2 days"
                    />
                    <InputError message={errors.estimated_time} className="mt-2" />
                </div>
            </div>

            <div>
                <InputLabel htmlFor="quote-message" value="Message (optional)" />
                <textarea
                    id="quote-message"
                    rows={4}
                    value={data.message}
                    onChange={(e) => setData('message', e.target.value)}
                    maxLength={limits.message_max}
                    placeholder="What the price includes, what you need to know first..."
                    className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                />
                <InputError message={errors.message} className="mt-2" />
            </div>

            <div className="flex items-center gap-3">
                <PrimaryButton disabled={processing}>{quote ? 'Update quote' : 'Send quote'}</PrimaryButton>
                {onCancel && <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>}
            </div>
        </form>
    );
}

import DurationInput from '@/Components/DurationInput';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import MoneyInput from '@/Components/MoneyInput';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
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

        // The page that comes back is handed on, for a caller that keeps part of it in its own state (the chat).
        post(route('requests.quotes.store', requestId), { preserveScroll: true, onSuccess: (page) => onDone?.(page) });
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <MoneyInput
                    id="quote-price"
                    label="Your price"
                    value={data.price}
                    onChange={(value) => setData('price', value)}
                    maxLength={limits.price_max}
                    placeholder="e.g. 80"
                    error={errors.price}
                    required
                />

                <DurationInput
                    id="quote-time"
                    label="How long it takes (optional)"
                    value={data.estimated_time}
                    onChange={(value) => setData('estimated_time', value)}
                    maxLength={limits.time_max}
                    placeholder="e.g. 2"
                    error={errors.estimated_time}
                />
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

import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { composeDuration, DURATION_UNITS, parseDuration } from '@/lib/durations';
import { useEffect, useState } from 'react';

// How long something takes, with the unit it is counted in: the same shape as
// MoneyInput. The form holds one text ("2 days"); the person types the amount and
// chooses the unit. `maxLength` is the limit of the whole text.
export default function DurationInput({ id, label, value, onChange, maxLength = 60, placeholder, error }) {
    const [amount, setAmount] = useState(() => parseDuration(value).amount);
    const [unit, setUnit] = useState(() => parseDuration(value).unit);

    // The form can change the text without us (it is emptied once the quote is saved).
    useEffect(() => {
        if (value === composeDuration(amount, unit)) return;

        const parsed = parseDuration(value);

        setAmount(parsed.amount);
        setUnit(parsed.unit);
    }, [value]);

    function change(nextAmount, nextUnit) {
        setAmount(nextAmount);
        setUnit(nextUnit);
        onChange(composeDuration(nextAmount, nextUnit));
    }

    return (
        <div>
            <InputLabel htmlFor={id} value={label} />

            <div className="mt-1 flex gap-2">
                <TextInput
                    id={id}
                    className="block min-w-0 flex-1 text-sm"
                    value={amount}
                    onChange={(e) => change(e.target.value, unit)}
                    maxLength={Math.max(maxLength - 7, 1)}
                    placeholder={placeholder}
                />

                <select
                    aria-label="Unit of time"
                    value={unit}
                    onChange={(e) => change(amount, e.target.value)}
                    className="w-28 shrink-0 rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                    {DURATION_UNITS.map((name) => (
                        <option key={name} value={name}>
                            {name}
                        </option>
                    ))}
                    <option value="">No unit</option>
                </select>
            </div>

            <InputError message={error} className="mt-1" />
        </div>
    );
}

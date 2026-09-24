import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import { composeMoney, CURRENCIES, parseMoney } from '@/lib/currencies';
import { useEffect, useState } from 'react';

// An amount with the currency it is in, for a request's budget and an offer's
// price. The form holds one text ("100 TND"); the person types the amount and
// chooses the currency. `maxLength` is the limit of the whole text.
export default function MoneyInput({ id, label, value, onChange, maxLength = 60, placeholder, error, required = false }) {
    const [amount, setAmount] = useState(() => parseMoney(value).amount);
    const [currency, setCurrency] = useState(() => parseMoney(value).currency);

    // The form can change the text without us (it is emptied once the post is saved).
    useEffect(() => {
        if (value === composeMoney(amount, currency)) return;

        const parsed = parseMoney(value);

        setAmount(parsed.amount);
        setCurrency(parsed.currency);
    }, [value]);

    function change(nextAmount, nextCurrency) {
        setAmount(nextAmount);
        setCurrency(nextCurrency);
        onChange(composeMoney(nextAmount, nextCurrency));
    }

    return (
        <div>
            <InputLabel htmlFor={id} value={label} />

            <div className="mt-1 flex gap-2">
                <TextInput
                    id={id}
                    className="block min-w-0 flex-1 text-sm"
                    value={amount}
                    onChange={(e) => change(e.target.value, currency)}
                    maxLength={Math.max(maxLength - 4, 1)}
                    placeholder={placeholder}
                    required={required}
                />

                <select
                    aria-label="Currency"
                    value={currency}
                    onChange={(e) => change(amount, e.target.value)}
                    className="w-24 shrink-0 rounded-md border-gray-300 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                    {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                            {code}
                        </option>
                    ))}
                    <option value="">No currency</option>
                </select>
            </div>

            <InputError message={error} className="mt-1" />
        </div>
    );
}

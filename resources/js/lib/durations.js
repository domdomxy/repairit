// The units a quote's "how long it takes" can be given in. Like a price, it is
// stored as one short text ("2 days"), so the amount and the unit are put together
// on the way out and taken apart again when a quote is edited.
export const DURATION_UNITS = ['hours', 'days', 'weeks', 'months'];

export const DEFAULT_DURATION_UNIT = 'days';

// "2 days" → { amount: '2', unit: 'days' }; "1 hour" → { amount: '1', unit: 'hours' }.
// A text that does not end with one of the units ("a couple of afternoons") is kept
// whole as the amount, with no unit, so editing it never changes what it says.
export function parseDuration(text) {
    const value = (text ?? '').trim();
    const match = value.match(/^(.*?)\s*(hour|day|week|month)s?$/i);

    if (match) {
        return { amount: match[1], unit: `${match[2].toLowerCase()}s` };
    }

    return { amount: value, unit: value ? '' : DEFAULT_DURATION_UNIT };
}

// The other way round: "1" takes the singular ("1 day"). Nothing typed means nothing to save.
export function composeDuration(amount, unit) {
    const value = amount.trim();

    if (value === '') return '';
    if (!unit) return value;

    return `${value} ${value === '1' ? unit.replace(/s$/, '') : unit}`;
}

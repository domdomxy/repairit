// The currencies a budget or a price can be given in. Both are stored as one
// short text ("100 TND"), so the amount and the currency are put together on the
// way out and taken apart again when a post is edited.
export const CURRENCIES = ['TND', 'EUR', 'USD', 'GBP', 'DZD', 'MAD', 'LYD', 'EGP'];

export const DEFAULT_CURRENCY = 'TND';

// "Up to 100 TND" → { amount: 'Up to 100', currency: 'TND' }. A text that does not
// end with one of the currencies (older posts, "80 TND / hour") is kept whole as the
// amount, with no currency, so editing it never changes what it says.
export function parseMoney(text) {
    const value = (text ?? '').trim();
    const match = value.match(/^(.*?)\s*([A-Za-z]{3})$/);
    const code = match?.[2].toUpperCase();

    if (match && CURRENCIES.includes(code)) {
        return { amount: match[1], currency: code };
    }

    return { amount: value, currency: value ? '' : DEFAULT_CURRENCY };
}

// The other way round. Nothing typed means nothing to save, whatever the currency.
export function composeMoney(amount, currency) {
    const value = amount.trim();

    if (value === '') return '';

    return currency ? `${value} ${currency}` : value;
}

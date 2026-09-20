// Puts text on the clipboard. The modern API needs a secure page (https or
// localhost), so a hidden text field and the old copy command are the fallback.
// Resolves to whether the text ended up on the clipboard.
export async function copyText(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the fallback below
    }

    try {
        const field = document.createElement('textarea');
        field.value = text;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(field);

        return copied;
    } catch {
        return false;
    }
}

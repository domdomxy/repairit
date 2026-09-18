export function formatDate(iso) {
    return iso ? new Date(iso).toLocaleDateString() : '';
}

export function formatDateTime(iso) {
    return iso ? new Date(iso).toLocaleString() : '';
}

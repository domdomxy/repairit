import { statusLabels, statusStyles } from '@/lib/support';

export default function SupportStatusBadge({ status }) {
    return (
        <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${statusStyles[status] ?? statusStyles.closed}`}>
            {statusLabels[status] ?? status}
        </span>
    );
}

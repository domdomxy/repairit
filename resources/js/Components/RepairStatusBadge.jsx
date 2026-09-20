import { repairStatusStyles } from '@/lib/repairs';

// A repair's status as a small coloured pill. The label is the server's.
export default function RepairStatusBadge({ status, label }) {
    return (
        <span
            className={`inline-block shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                repairStatusStyles[status] ?? repairStatusStyles.received
            }`}
        >
            {label ?? status}
        </span>
    );
}

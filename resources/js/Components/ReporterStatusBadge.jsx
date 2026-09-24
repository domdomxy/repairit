import { reportStatusStyles } from '@/lib/reports';

// Where a report stands, in the words its reporter sees (the label comes from the server).
export default function ReporterStatusBadge({ status, label }) {
    return (
        <span
            className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${reportStatusStyles[status] ?? reportStatusStyles.dismissed}`}
        >
            {label}
        </span>
    );
}

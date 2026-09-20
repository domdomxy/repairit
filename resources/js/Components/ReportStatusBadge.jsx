import { reportStatusLabels, reportStatusStyles } from '@/lib/reports';

export default function ReportStatusBadge({ status }) {
    return (
        <span
            className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                reportStatusStyles[status] ?? reportStatusStyles.dismissed
            }`}
        >
            {reportStatusLabels[status] ?? status}
        </span>
    );
}

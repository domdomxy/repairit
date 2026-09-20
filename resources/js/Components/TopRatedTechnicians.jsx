import { Link } from '@inertiajs/react';
import Avatar from '@/Components/Avatar';

const AVAILABILITY_DOT = {
    available: 'bg-green-500',
    busy: 'bg-yellow-500',
};

// A short ranked list of the best rated technicians. `technicians` is already
// sorted; each entry links to the technician's profile.
export default function TopRatedTechnicians({ technicians, className = '' }) {
    return (
        <section className={`rounded-lg bg-white p-4 shadow dark:bg-gray-800 ${className}`}>
            <h3 className="mb-3 font-semibold">Top rated technicians</h3>

            {technicians.length === 0 ? (
                <p className="text-sm text-gray-500">No technician has been rated yet.</p>
            ) : (
                <ol className="space-y-1">
                    {technicians.map((technician, index) => (
                        <li key={technician.id}>
                            <Link
                                href={route('technicians.show', technician.id)}
                                className="flex items-center gap-3 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <span className="w-4 shrink-0 text-center text-sm font-semibold text-gray-400">
                                    {index + 1}
                                </span>
                                <Avatar user={technician} size="sm" />
                                <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                                        <span className="truncate">{technician.name}</span>
                                        <span
                                            className={`h-2 w-2 shrink-0 rounded-full ${
                                                AVAILABILITY_DOT[technician.availability_status] ?? 'bg-gray-400'
                                            }`}
                                            title={technician.availability_status}
                                        />
                                    </p>
                                    <p className="truncate text-xs text-gray-500">
                                        ⭐ {Number(technician.rating_avg).toFixed(2)} ({technician.rating_count})
                                        {technician.city && <> · {technician.city}</>}
                                    </p>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

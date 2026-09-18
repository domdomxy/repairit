import { Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Technician({ conversationCount }) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Technician Dashboard</h2>}>
            <div className="max-w-4xl mx-auto py-8 px-4 space-y-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p>You have {conversationCount} conversation(s) with customers.</p>
                    <div className="mt-4 flex gap-3">
                        <Link href={route('conversations.index')} className="text-indigo-600 underline">
                            View messages
                        </Link>
                        {/* Profile-edit link goes here once that page exists */}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
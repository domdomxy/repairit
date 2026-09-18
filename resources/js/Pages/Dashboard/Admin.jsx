import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

export default function Admin({ userCount, technicianCount }) {
    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold">Admin Dashboard</h2>}>
            <div className="max-w-4xl mx-auto py-8 px-4 grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm text-gray-500">Total users</p>
                    <p className="text-2xl font-semibold">{userCount}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <p className="text-sm text-gray-500">Technicians</p>
                    <p className="text-2xl font-semibold">{technicianCount}</p>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
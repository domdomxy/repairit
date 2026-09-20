import AdminSidebar from '@/Components/AdminSidebar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

// Every admin page renders inside this: a fixed sidebar on the left and a
// content area on the right that scrolls on its own. 65px = the top nav bar.
export default function AdminLayout({ children }) {
    return (
        <AuthenticatedLayout>
            <div className="flex flex-1 flex-col md:h-[calc(100dvh-65px)] md:flex-row md:overflow-hidden">
                <AdminSidebar />
                <div className="min-w-0 flex-1 md:overflow-y-auto">{children}</div>
            </div>
        </AuthenticatedLayout>
    );
}

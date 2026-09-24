import AdminSidebar from '@/Components/AdminSidebar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';

// Every admin page renders inside this: a sidebar that stays put below the
// top bar while the page beside it scrolls — the same sticky pattern the
// account rail (SidebarLayout) uses elsewhere in the app.
export default function AdminLayout({ children }) {
    return (
        <AuthenticatedLayout>
            <div className="flex w-full flex-1 flex-col md:flex-row md:items-start">
                <AdminSidebar />
                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </AuthenticatedLayout>
    );
}

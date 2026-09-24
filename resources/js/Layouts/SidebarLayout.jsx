import ProfileSidebar from '@/Components/ProfileSidebar';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { usePage } from '@inertiajs/react';

// The authenticated layout plus the account rail on the left: the same
// sidebar the feed, quotes, repairs and settings pages show, so every page
// it links to keeps it in view. The page itself renders in the column beside it.
export default function SidebarLayout({ children }) {
    const { auth } = usePage().props;

    return (
        <AuthenticatedLayout>
            <div className="flex w-full flex-1 flex-col px-4 py-4 sm:px-6 lg:px-8">
                <div className="flex flex-1 flex-col gap-6 lg:flex-row lg:items-start">
                    <aside className="w-full lg:sticky lg:top-20 lg:w-56 lg:shrink-0 lg:self-stretch">
                        <ProfileSidebar user={auth.user} className="h-full" />
                    </aside>

                    <div className="min-w-0 flex-1">{children}</div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

import { SidebarProvider } from '@/shared/ui/sidebar';
import { AppSidebar, AppHeader } from '@/widgets';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <AppSidebar />
                <div className="flex flex-1 flex-col">
                    <AppHeader />
                    <main className="flex-1 p-6">{children}</main>
                </div>
            </div>
        </SidebarProvider>
    );
};

export default DashboardLayout;

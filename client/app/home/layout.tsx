import { AppSidebar } from "@/components/home/app-sidebar";
import Header from "@/components/home/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col gap-4 p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
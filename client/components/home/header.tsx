import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";
import { ThemeToggleButton } from "@/components/home/theme-toggle";

export default async function Header() {
  const session = await auth();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2  px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2">
          {/* You can add breadcrumbs or page title here */}
        </div>
        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Docs Link */}
          <Button variant="ghost" size="sm" asChild>
            <Link href="/docs">Docs</Link>
          </Button>

          {/* Theme toggle */}
          <ThemeToggleButton />

          {/* User Profile */}
          {session?.user && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary">
                <span className="text-sm font-medium">
                  {(session.user.username || session.user.email || "U").charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

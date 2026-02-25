import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {  Bell } from "lucide-react";
import Link from "next/link";

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

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </Button>

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

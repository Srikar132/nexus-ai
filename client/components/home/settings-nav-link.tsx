"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsNavLinkProps {
  href: string;
  children: React.ReactNode;
}

export function SettingsNavLink({ href, children }: SettingsNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`
        relative block px-3 py-2 text-sm rounded-lg font-medium 
        transition-all duration-150
        ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }
      `}
    >
      {children}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r" />
      )}
    </Link>
  );
}

import { SettingsNavLink } from "@/components/home/settings-nav-link";

const settingsSections = [
  { id: "general", label: "General", href: "/home/settings/general" },
  { id: "privacy", label: "Privacy", href: "/home/settings/privacy" },
  { id: "billing", label: "Billing", href: "/home/settings/billing" },
  { id: "integrations", label: "Integrations", href: "/home/settings/integrations" },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Compact Sidebar */}
      <aside className="w-56 border-r border-border bg-card/50">
        <div className="sticky top-0 p-6">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Manage preferences</p>
          </div>
          <nav className="space-y-0.5">
            {settingsSections.map((section) => (
              <SettingsNavLink key={section.id} href={section.href}>
                {section.label}
              </SettingsNavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}

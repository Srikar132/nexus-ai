import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntegrationsSettingsPage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold mb-6">Integrations</h2>
      <Card>
        <CardHeader>
          <CardTitle>Connected Services</CardTitle>
          <CardDescription>
            Manage your third-party integrations and connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Integration settings will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

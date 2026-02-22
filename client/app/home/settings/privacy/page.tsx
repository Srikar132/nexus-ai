import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacySettingsPage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold mb-6">Privacy</h2>
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>
            Manage your privacy preferences and data settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Privacy settings will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

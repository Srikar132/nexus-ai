import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingSettingsPage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-semibold mb-6">Billing</h2>
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>
            Manage your subscription and payment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Billing information will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

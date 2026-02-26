"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Zap, FileUp, Receipt } from "lucide-react";

const usageItems = [
  { icon: Zap, label: "AI Requests", used: 120, total: 500 },
  { icon: FileUp, label: "File Uploads", used: 3, total: 10 },
];

export default function BillingSettingsPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-6">
        <CreditCard className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-2xl font-semibold">Billing</h2>
          <p className="text-sm text-muted-foreground">
            Manage your plan, usage, and payments
          </p>
        </div>
      </div>

      {/* Current Plan */}
      <Card>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">Free Plan</p>
                  <Badge variant="secondary">Current</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Limited requests and file uploads
                </p>
              </div>
            </div>
            <Button size="sm">Upgrade to Pro</Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="mt-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Usage This Month</CardTitle>
          <CardDescription>Resets on March 1, 2026</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {usageItems.map((item, index) => {
            const Icon = item.icon;
            const pct = Math.round((item.used / item.total) * 100);
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-medium tabular-nums">
                    {item.used}
                    <span className="text-muted-foreground font-normal"> / {item.total}</span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {index < usageItems.length - 1 && <Separator className="mt-5" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="mt-4">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Billing History</CardTitle>
          </div>
          <CardDescription>Your recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Your billing history will appear here once you upgrade.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
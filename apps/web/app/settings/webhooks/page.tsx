"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WebhooksManager } from "@/components/settings";
import {
  AdminOnlySettingsState,
  SettingsAccessLoadingState,
  useAdminSettingsAccess,
} from "../_components/admin-settings-access";

export default function WebhooksSettingsPage() {
  const { loading, isAdmin, error } = useAdminSettingsAccess();

  if (loading) {
    return <SettingsAccessLoadingState label="Checking webhook settings access…" />;
  }

  if (error) {
    return (
      <AdminOnlySettingsState
        title="Unable to load webhook settings"
        description="We couldn't verify whether you can manage outbound webhooks right now."
        errorMessage={error}
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminOnlySettingsState
        title="Admin Access Required"
        description="Webhook endpoint management is limited to organization admins and owners."
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Webhook Endpoints</h1>
          <p className="text-sm text-muted-foreground">
            Configure outbound webhook subscribers, then drill into delivery history and the
            durable integration event log when a receiver needs recovery.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/webhook-deliveries">Deliveries</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integration-events">Event Log</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/api-tokens">API Tokens</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound Surface</CardTitle>
          <CardDescription>
            Webhook endpoint configuration lives here. Use deliveries for retry and DLQ recovery,
            and the event log for durable replay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksManager />
        </CardContent>
      </Card>
    </div>
  );
}
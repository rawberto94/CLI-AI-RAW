"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations('settingsPages');
  const tSettings = useTranslations('settings');
  const tSecurity = useTranslations('settings.security');

  if (loading) {
    return <SettingsAccessLoadingState label={t('webhooks.checkingAccess')} />;
  }

  if (error) {
    return (
      <AdminOnlySettingsState
        title={t('webhooks.unableToLoadTitle')}
        description={t('webhooks.unableToLoadDesc')}
        errorMessage={error}
      />
    );
  }

  if (!isAdmin) {
    return (
      <AdminOnlySettingsState
        title={tSettings('adminAccessRequired')}
        description={t('webhooks.adminRequiredDesc')}
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('webhooks.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('webhooks.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/webhook-deliveries">{t('webhooks.deliveries')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integration-events">{t('webhooks.eventLog')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/api-tokens">{tSecurity('apiTokens')}</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('webhooks.outboundSurface')}</CardTitle>
          <CardDescription>
            {t('webhooks.outboundSurfaceDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WebhooksManager />
        </CardContent>
      </Card>
    </div>
  );
}
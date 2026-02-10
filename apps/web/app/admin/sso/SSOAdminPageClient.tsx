'use client';

import { DashboardLayout } from '@/components/layout/AppLayout';
import SSOConfigManager from '@/components/admin/SSOConfigManager';

export default function SSOAdminPageClient() {
  return (
    <DashboardLayout
      title="SSO Configuration"
      description="Manage SAML 2.0 and OpenID Connect single sign-on providers"
    >
      <SSOConfigManager />
    </DashboardLayout>
  );
}

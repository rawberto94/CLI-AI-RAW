'use client';

import { useTranslations } from 'next-intl';
import { DashboardLayout } from '@/components/layout/AppLayout';
import SSOConfigManager from '@/components/admin/SSOConfigManager';

export default function SSOAdminPageClient() {
  const t = useTranslations('sso');
  return (
    <DashboardLayout
      title={t('title')}
      description={t('description')}
    >
      <SSOConfigManager />
    </DashboardLayout>
  );
}

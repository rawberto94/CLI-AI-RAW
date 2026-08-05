/**
 * Audit Logs Page
 * 
 * Comprehensive view of all system audit logs with advanced filtering,
 * timeline visualization, and export capabilities for compliance reporting.
 * 
 * Features:
 * - Real-time audit log monitoring
 * - Multi-criteria filtering (category, action, user, date range)
 * - Timeline visualization with activity grouping
 * - Export to CSV for compliance audits
 * - Search across actions, users, and resources
 * - Activity statistics and insights
 */

'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { unwrapApiResponseData } from '@/lib/api-fetch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield } from 'lucide-react';

interface AuditLogsAccessPayload {
  user?: {
    role?: string | null;
  } | null;
}



function AuditLogsPageLoading() {
  const tNav = useTranslations('navigation');
  const t = useTranslations('admin');
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{tNav('nav.auditLogs.name')}</h1>
              <p className="text-slate-300 text-sm mt-0.5">
                {t('audit.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <Card>
          <CardContent className="p-5">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuditLogsPage() {
  const tNav = useTranslations('navigation');
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [accessLoading, setAccessLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
          throw new Error('We could not verify your audit log access.');
        }

        const data = unwrapApiResponseData<AuditLogsAccessPayload>(await response.json());
        if (!active) return;

        const role = (data.user?.role ?? '').toLowerCase();
        setIsAdmin(role === 'admin' || role === 'owner');
        setAccessError(null);
      } catch (error) {
        if (!active) return;
        setIsAdmin(false);
        setAccessError(error instanceof Error ? error.message : 'We could not verify your audit log access.');
      } finally {
        if (active) setAccessLoading(false);
      }
    }

    loadAccess();
    return () => {
      active = false;
    };
  }, []);

  if (accessLoading) {
    return <AuditLogsPageLoading />;
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.unableToLoadTitle')}</CardTitle>
              <CardDescription>
                {t('audit.unableToLoadDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">{accessError}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/dashboard">{t('audit.backToDashboard')}</Link>
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  {t('audit.retry')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('audit.adminAccessRequiredTitle')}</CardTitle>
              <CardDescription>
                {t('audit.adminAccessRequiredDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard">{t('audit.backToDashboard')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{tNav('nav.auditLogs.name')}</h1>
                <p className="text-slate-300 text-sm mt-0.5">
                  {t('audit.subtitle')}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">{tCommon('status')}</div>
                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  {t('audit.liveMonitoring')}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">{t('audit.compliance')}</div>
                <div className="text-sm font-semibold text-violet-400">
                  ✓ {t('audit.fadpCompliant')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6">
        <Suspense fallback={<AuditLogsPageLoading />}>
          <AuditLogViewer />
        </Suspense>
      </div>
    </div>
  );
}

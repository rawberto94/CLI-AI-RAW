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

import { Suspense } from 'react';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, ClipboardList } from 'lucide-react';

function AuditLogsPageLoading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
              <p className="text-slate-300 text-sm mt-0.5">
                System activity and compliance tracking
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6">
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
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-sm">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
                <p className="text-slate-300 text-sm mt-0.5">
                  System activity and compliance tracking
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="hidden lg:flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-slate-400">Status</div>
                <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Monitoring
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Compliance</div>
                <div className="text-sm font-semibold text-emerald-400">
                  ✓ FADP Compliant
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-12 py-6">
        <Suspense fallback={<AuditLogsPageLoading />}>
          <AuditLogViewer />
        </Suspense>
      </div>
    </div>
  );
}

'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import { AIDecisionAuditDashboard } from '@/components/ai/AIDecisionAuditDashboard';
import { getTenantId } from '@/lib/tenant';

export default function AIDecisionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <div className="max-w-[1600px] mx-auto py-6 px-6 space-y-6">
        <AIDecisionAuditDashboard tenantId={getTenantId()} />
      </div>
    </Suspense>
  );
}

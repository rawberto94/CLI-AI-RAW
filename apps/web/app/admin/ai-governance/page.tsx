'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import AiGovernanceDashboard from '@/components/admin/AiGovernanceDashboard';

export default function AiGovernancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AiGovernanceDashboard />
    </Suspense>
  );
}

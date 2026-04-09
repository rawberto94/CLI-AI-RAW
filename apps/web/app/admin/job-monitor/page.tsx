'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import JobMonitor from '@/components/admin/JobMonitor';

export default function JobMonitorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <JobMonitor />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import RecordsManager from '@/components/admin/RecordsManager';

export default function RecordsManagementPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecordsManager />
    </Suspense>
  );
}

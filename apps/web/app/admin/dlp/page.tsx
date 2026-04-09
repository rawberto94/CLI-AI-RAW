'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import DlpPoliciesManager from '@/components/admin/DlpPoliciesManager';

export default function DlpPoliciesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DlpPoliciesManager />
    </Suspense>
  );
}

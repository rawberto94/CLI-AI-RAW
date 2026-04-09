'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import AmendmentWorkflow from '@/components/amendments/AmendmentWorkflow';

export default function AmendmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AmendmentWorkflow />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import PreApprovalGates from '@/components/governance/PreApprovalGates';

export default function PreApprovalGatesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PreApprovalGates />
    </Suspense>
  );
}

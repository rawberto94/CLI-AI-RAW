'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import DoAMatrix from '@/components/governance/DoAMatrix';

export default function DelegationOfAuthorityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DoAMatrix />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import ClauseGovernanceHub from '@/components/clauses/ClauseGovernanceHub';

export default function ClauseGovernancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClauseGovernanceHub />
    </Suspense>
  );
}

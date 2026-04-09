'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import RoutingRulesManager from '@/components/governance/RoutingRulesManager';

export default function RoutingRulesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RoutingRulesManager />
    </Suspense>
  );
}

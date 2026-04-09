'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import LegalHoldManager from '@/components/admin/LegalHoldManager';

export default function LegalHoldsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LegalHoldManager />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import EvidenceRepository from '@/components/evidence/EvidenceRepository';

export default function EvidencePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EvidenceRepository />
    </Suspense>
  );
}

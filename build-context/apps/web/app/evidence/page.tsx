'use client';

import { Suspense } from 'react';
import EvidenceRepository from '@/components/evidence/EvidenceRepository';

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <EvidenceRepository />
    </Suspense>
  );
}

'use client';

import { Suspense } from 'react';
import PreApprovalGates from '@/components/governance/PreApprovalGates';

export default function PreApprovalGatesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <PreApprovalGates />
    </Suspense>
  );
}

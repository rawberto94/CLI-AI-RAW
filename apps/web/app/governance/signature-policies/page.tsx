'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import SignaturePolicies from '@/components/governance/SignaturePolicies';

export default function SignaturePoliciesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SignaturePolicies />
    </Suspense>
  );
}

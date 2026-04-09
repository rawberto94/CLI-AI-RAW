'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import ContractRequestsHub from '@/components/requests/ContractRequestsHub';

export default function ContractRequestsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContractRequestsHub />
    </Suspense>
  );
}

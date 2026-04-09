'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import ContractRequestForm from '@/components/requests/ContractRequestForm';

export default function NewRequestPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ContractRequestForm />
    </Suspense>
  );
}

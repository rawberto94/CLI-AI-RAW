'use client';

import { Suspense } from 'react';
import ContractRequestForm from '@/components/requests/ContractRequestForm';

export default function NewRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <ContractRequestForm />
    </Suspense>
  );
}

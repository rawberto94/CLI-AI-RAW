'use client';

import { Suspense } from 'react';
import { PageBreadcrumb } from '@/components/navigation';
import { PageSkeleton } from '@/components/ui/skeleton';
import SpendManagementHub from '@/components/spend/SpendManagementHub';

export default function SpendManagementPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <PageBreadcrumb />
      </div>
      <Suspense fallback={<PageSkeleton cards={4} />}>
        <SpendManagementHub />
      </Suspense>
    </div>
  );
}

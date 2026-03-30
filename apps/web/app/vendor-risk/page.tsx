'use client';

import { Suspense } from 'react';
import { PageBreadcrumb } from '@/components/navigation';
import VendorRiskDashboard from '@/components/vendor-risk/VendorRiskDashboard';

export default function VendorRiskPage() {
  return (
    <div className="p-6">
      <div className="mb-4">
        <PageBreadcrumb />
      </div>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <VendorRiskDashboard />
      </Suspense>
    </div>
  );
}

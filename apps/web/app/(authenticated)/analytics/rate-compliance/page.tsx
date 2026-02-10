import { Suspense } from 'react';
import RateComplianceChecker from '@/components/analytics/RateComplianceChecker';

export const metadata = { title: 'Rate Compliance — ConTigo' };

export default function RateCompliancePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <RateComplianceChecker />
    </Suspense>
  );
}

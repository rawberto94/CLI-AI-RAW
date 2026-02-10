'use client';

import { Suspense } from 'react';
import RecordsManager from '@/components/admin/RecordsManager';

export default function RecordsManagementPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <RecordsManager />
    </Suspense>
  );
}

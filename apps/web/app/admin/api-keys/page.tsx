'use client';

import { Suspense } from 'react';
import { PageSkeleton } from '@/components/ui/skeleton';
import ApiKeyManager from '@/components/admin/ApiKeyManager';

export default function ApiKeysPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ApiKeyManager />
    </Suspense>
  );
}

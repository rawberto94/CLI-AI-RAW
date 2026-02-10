import { Suspense } from 'react';
import ClauseVersionHistory from '@/components/clauses/ClauseVersionHistory';

export const metadata = { title: 'Clause Version History — ConTigo' };

export default function ClauseVersionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <ClauseVersionHistory />
    </Suspense>
  );
}

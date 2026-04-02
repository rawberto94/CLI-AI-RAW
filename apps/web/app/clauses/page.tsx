/**
 * Clauses Library Page
 * Standard contract clause management
 */

import { Suspense } from 'react';
import { ClausesLibrary } from '@/components/clauses';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clause Library | ConTigo',
  description: 'Clause Library — Manage and monitor your contract intelligence platform',
};


export default function ClausesPage() {
  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
        </div>
      }>
        <ClausesLibrary />
      </Suspense>
    </div>
  );
}

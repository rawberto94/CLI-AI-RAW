'use client';

import { Suspense } from 'react';
import DocumentExpiryMonitor from '@/components/document-expiry/DocumentExpiryMonitor';

export default function DocumentExpiryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 p-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-slate-700 rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-gray-200 dark:bg-slate-700 rounded-lg" />
      </div>
    }>
      <DocumentExpiryMonitor />
    </Suspense>
  );
}

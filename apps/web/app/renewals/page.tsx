'use client';

import React from 'react';
import { RenewalManager } from '@/components/workflows';
import { PageBreadcrumb } from '@/components/navigation';

export default function RenewalsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20 dark:from-slate-900 dark:via-green-950/30 dark:to-violet-950/20">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-6 py-3 sticky top-0 z-10">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <div className="h-[calc(100vh-7rem)]">
        <RenewalManager />
      </div>
    </div>
  );
}

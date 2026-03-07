'use client';

import React from 'react';
import { ContractHealthScore } from '@/components/intelligence';
import { PageBreadcrumb } from '@/components/navigation';

export default function HealthPage() {
  return (
    <div className="h-full overflow-hidden bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/40">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-3 sticky top-0 z-10">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        <ContractHealthScore />
      </div>
    </div>
  );
}

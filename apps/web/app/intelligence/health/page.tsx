'use client';

import React from 'react';
import { ContractHealthScore } from '@/components/intelligence';
import { PageBreadcrumb } from '@/components/navigation';
import { CrossModuleActions, healthScoreActions } from '@/components/navigation';
import { Activity } from 'lucide-react';

export default function HealthPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <div className="h-[calc(100vh-4rem)]">
        <ContractHealthScore />
      </div>
    </div>
  );
}

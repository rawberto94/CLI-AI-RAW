'use client';

import React from 'react';
import { ApprovalsQueue } from '@/components/workflows';
import { PageBreadcrumb } from '@/components/navigation';

export default function ApprovalsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <div className="h-[calc(100vh-7rem)]">
        <ApprovalsQueue />
      </div>
    </div>
  );
}

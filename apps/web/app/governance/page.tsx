'use client';

import { AIGuardrails } from '@/components/governance';
import { PageBreadcrumb } from '@/components/navigation';

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <AIGuardrails />
    </div>
  );
}

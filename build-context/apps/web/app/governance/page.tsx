'use client';

import { AIGuardrails } from '@/components/governance';
import { PageBreadcrumb } from '@/components/navigation';

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50/50 to-zinc-50/30">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-10">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <AIGuardrails />
    </div>
  );
}

'use client';

import { IntegrationHub } from '@/components/integrations';
import { PageBreadcrumb } from '@/components/navigation';

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-violet-50/20">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-30">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <IntegrationHub />
    </div>
  );
}

'use client';

import { IntegrationHub } from '@/components/integrations';
import { PageBreadcrumb } from '@/components/navigation';

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <IntegrationHub />
    </div>
  );
}

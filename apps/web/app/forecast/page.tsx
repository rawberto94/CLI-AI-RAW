'use client';

import React from 'react';
import { ForecastingDashboard } from '@/components/analytics/ForecastingDashboard';
import { PageBreadcrumb } from '@/components/navigation';

export default function ForecastPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20">
      {/* Breadcrumb Navigation */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-6 py-3 sticky top-0 z-10">
        <PageBreadcrumb />
      </div>
      
      {/* Main Content */}
      <ForecastingDashboard />
    </div>
  );
}

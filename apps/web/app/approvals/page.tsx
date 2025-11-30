'use client';

import React, { useState } from 'react';
import { ApprovalsQueue, ApprovalAnalytics } from '@/components/workflows';
import { PageBreadcrumb } from '@/components/navigation';
import { Button } from '@/components/ui/button';
import { LayoutList, BarChart3, ArrowLeft } from 'lucide-react';

export default function ApprovalsPage() {
  const [view, setView] = useState<'queue' | 'analytics'>('queue');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Breadcrumb Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <PageBreadcrumb />
        <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-1 bg-slate-50">
          <Button
            variant={view === 'queue' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('queue')}
            className="gap-2"
          >
            <LayoutList className="h-4 w-4" />
            Queue
          </Button>
          <Button
            variant={view === 'analytics' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('analytics')}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      {view === 'queue' ? (
        <div className="h-[calc(100vh-7rem)]">
          <ApprovalsQueue />
        </div>
      ) : (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6 flex items-center gap-4">
            <button 
              onClick={() => setView('queue')}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Queue
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Approval Analytics</h1>
          </div>
          <ApprovalAnalytics variant="full" />
        </div>
      )}
    </div>
  );
}

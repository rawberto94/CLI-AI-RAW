/**
 * Automation Settings Page
 * Configure and manage automated workflows
 */

'use client';

import { WorkflowAutomation } from '@/components/automation';
import { Settings as _Settings, Zap } from 'lucide-react';



export default function AutomationPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-violet-100">
            <Zap className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Automation</h1>
            <p className="text-slate-500">
              Configure automated workflows for contract processing
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <WorkflowAutomation />
    </div>
  );
}

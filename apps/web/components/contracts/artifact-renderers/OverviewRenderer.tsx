/**
 * Overview Artifact Content Renderer
 * Memoized component for rendering overview artifact data
 */

import React, { memo } from 'react';
import { FileText } from 'lucide-react';
import type { OverviewData } from '@/types/artifacts';

interface OverviewRendererProps {
  data: OverviewData;
}

export const OverviewRenderer = memo(function OverviewRenderer({ data }: OverviewRendererProps) {
  return (
    <div className="space-y-5">
      {data.summary && (
        <div className="p-6 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 rounded-xl border-2 border-violet-100 dark:border-violet-900 shadow-sm">
          <h4 className="font-bold text-base text-violet-900 dark:text-violet-100 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Executive Summary
          </h4>
          <p className="text-base leading-relaxed text-violet-900/90 dark:text-violet-100/90">
            {data.summary}
          </p>
        </div>
      )}
      {data.parties && data.parties.length > 0 && (
        <div>
          <h4 className="font-bold text-base mb-4 text-gray-900 dark:text-gray-100">Contract Parties</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.parties.map((party, i) => (
              <div key={i} className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border-2 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{party.name}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize mt-1 font-medium">{party.role}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.contractType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 bg-white dark:bg-gray-800 rounded-lg border-2 shadow-sm">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">Contract Type</p>
            <p className="font-bold text-lg text-gray-900 dark:text-gray-100">{data.contractType}</p>
          </div>
          {data.totalValue && (
            <div className="p-5 bg-white dark:bg-gray-800 rounded-lg border-2 shadow-sm">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2 font-medium">Total Value</p>
              <p className="font-bold text-lg text-green-600 dark:text-green-400">
                ${data.totalValue.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

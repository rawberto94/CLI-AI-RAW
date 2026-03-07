/**
 * Risk Artifact Content Renderer
 * Memoized component for rendering risk artifact data
 */

import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { RiskData } from '@/types/artifacts';

interface RiskRendererProps {
  data: RiskData;
}

export const RiskRenderer = memo(function RiskRenderer({ data }: RiskRendererProps) {
  if (!data.risks || data.risks.length === 0) {
    return (
      <p className="text-base text-gray-500 dark:text-gray-400 text-center py-8">No risks identified</p>
    );
  }

  return (
    <div className="space-y-4">
      {data.risks.map((risk, i) => (
        <div key={i} className={`p-6 rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow ${
          risk.severity?.toLowerCase() === 'high' ? 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-red-300 dark:border-red-800' :
          risk.severity?.toLowerCase() === 'medium' ? 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 border-yellow-300 dark:border-yellow-800' :
          'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
        }`}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{risk.title || risk.category || 'Risk'}</h4>
            <Badge variant={risk.severity?.toLowerCase() === 'high' ? 'destructive' : 'secondary'} className="text-xs capitalize font-semibold px-3 py-1">
              {risk.severity}
            </Badge>
          </div>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{risk.rationale || risk.description}</p>
          {risk.mitigation && (
            <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-300 dark:border-gray-600">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">💡 Mitigation Strategy:</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{risk.mitigation}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
});

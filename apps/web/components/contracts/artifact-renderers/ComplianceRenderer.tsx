/**
 * Compliance Artifact Content Renderer
 * Memoized component for rendering compliance artifact data
 */

import React, { memo } from 'react';
import { Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ComplianceData } from '@/types/artifacts';

interface ComplianceRendererProps {
  data: ComplianceData;
}

export const ComplianceRenderer = memo(function ComplianceRenderer({ data }: ComplianceRendererProps) {
  return (
    <div className="space-y-5">
      {data.summary && (
        <div className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 rounded-xl border-2 border-indigo-200 dark:border-indigo-800 shadow-sm">
          <h4 className="font-bold text-base text-indigo-900 dark:text-indigo-100 mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Summary
          </h4>
          <p className="text-base leading-relaxed text-indigo-900/90 dark:text-indigo-100/90">{data.summary}</p>
        </div>
      )}
      {data.compliance && data.compliance.length > 0 && (
        <div className="space-y-3">
          {data.compliance.map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-6 bg-white dark:bg-gray-800 rounded-xl border-2 shadow-sm hover:shadow-md transition-shadow">
              {item.present ? (
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <p className="font-bold text-base text-gray-900 dark:text-gray-100">{item.standard || item.requirement}</p>
                  <Badge variant={item.present ? 'default' : 'secondary'} className="text-xs font-semibold px-3 py-1">
                    {item.present ? '✓ Compliant' : '! Not Found'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">{item.notes || item.details}</p>
                {item.excerpt && (
                  <p className="text-sm italic text-gray-500 dark:text-gray-400 mt-3 pl-4 border-l-4 border-indigo-300 dark:border-indigo-700 leading-relaxed">
                    &ldquo;{item.excerpt}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

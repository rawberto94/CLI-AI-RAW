/**
 * Clauses Artifact Content Renderer
 * Memoized component for rendering clauses artifact data
 */

import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { ClausesData } from '@/types/artifacts';

interface ClausesRendererProps {
  data: ClausesData;
}

export const ClausesRenderer = memo(function ClausesRenderer({ data }: ClausesRendererProps) {
  if (!data.clauses || data.clauses.length === 0) {
    return (
      <p className="text-base text-gray-500 dark:text-gray-400 text-center py-8">No clauses extracted</p>
    );
  }

  return (
    <div className="space-y-4">
      {data.clauses.map((clause, i) => (
        <div key={i} className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 hover:border-violet-300 dark:hover:border-violet-700 transition-all shadow-sm hover:shadow-md">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h4 className="font-bold text-lg mb-2 text-gray-900 dark:text-gray-100">
                {clause.name || clause.category || 'Clause'}
              </h4>
            </div>
            {clause.relevance && (
              <Badge variant="outline" className="text-xs font-semibold px-3 py-1 bg-violet-50 dark:bg-violet-950">
                {Math.round(clause.relevance * 100)}% relevant
              </Badge>
            )}
          </div>
          <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
            {clause.excerpt || clause.text || 'No description available'}
          </p>
          {clause.location && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 pt-4 border-t border-dashed font-medium">
              📍 Section: {clause.location}
            </p>
          )}
        </div>
      ))}
    </div>
  );
});

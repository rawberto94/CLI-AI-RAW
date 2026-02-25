/**
 * UploadStatsGrid — Compact inline stats bar during upload.
 * Shows real-time file processing status.
 */

'use client';

import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadStatsGridProps {
  totalFiles: number;
  processingCount: number;
  pendingCount: number;
  completedCount: number;
  errorCount: number;
}

export function UploadStatsGrid({ totalFiles, processingCount, pendingCount, completedCount, errorCount }: UploadStatsGridProps) {
  const items = [
    processingCount > 0 && { icon: Loader2, label: `${processingCount} processing`, color: 'text-violet-600 dark:text-violet-400', spin: true },
    pendingCount > 0 && { icon: Clock, label: `${pendingCount} queued`, color: 'text-amber-600 dark:text-amber-400' },
    completedCount > 0 && { icon: CheckCircle2, label: `${completedCount} done`, color: 'text-green-600 dark:text-green-400' },
    errorCount > 0 && { icon: AlertTriangle, label: `${errorCount} failed`, color: 'text-red-600 dark:text-red-400' },
  ].filter(Boolean) as Array<{ icon: React.ElementType; label: string; color: string; spin?: boolean }>;

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {totalFiles} file{totalFiles !== 1 ? 's' : ''}
      </span>
      <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>
      {items.map(({ icon: Icon, label, color, spin }) => (
        <span key={label} className={cn('flex items-center gap-1.5 text-sm', color)}>
          <Icon className={cn('h-3.5 w-3.5', spin && 'animate-spin')} aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

export default UploadStatsGrid;

/**
 * Processing Queue Indicator
 * Shows real-time processing jobs status in the UI
 */

'use client';

import { useState, useEffect, memo } from 'react';
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  FileText,
  ChevronRight,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface ProcessingJob {
  id: string;
  contractId: string;
  contractName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  stage: string;
  progress: number;
  startedAt?: string;
}

interface QueueStatus {
  active: number;
  pending: number;
  completed: number;
  failed: number;
  jobs: ProcessingJob[];
}

export const ProcessingQueueIndicator = memo(function ProcessingQueueIndicator({
  className,
}: {
  className?: string;
}) {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/processing-status', {
          cache: 'no-store',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch queue status');
        }
        
        const data = await response.json();
        setStatus({
          active: data.activeJobs || 0,
          pending: data.pendingJobs || 0,
          completed: data.completedJobs || 0,
          failed: data.failedJobs || 0,
          jobs: data.recentJobs || [],
        });
      } catch (err) {
        // Use mock data on error
        setStatus({
          active: 0,
          pending: 0,
          completed: 0,
          failed: 0,
          jobs: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  const totalActive = (status?.active || 0) + (status?.pending || 0);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5 px-2 py-1', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      </div>
    );
  }

  // Don't show if no activity
  if (totalActive === 0 && (status?.failed || 0) === 0) {
    return null;
  }

  const hasIssues = (status?.failed || 0) > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 px-2.5 gap-1.5 rounded-lg',
            hasIssues 
              ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' 
              : 'bg-violet-50 text-violet-700 hover:bg-violet-100',
            className
          )}
        >
          {totalActive > 0 ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : hasIssues ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <Zap className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-medium">
            {totalActive > 0 
              ? `${totalActive} Processing` 
              : hasIssues 
                ? `${status?.failed} Failed` 
                : 'Queue Idle'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Processing Queue</h4>
            <Link href="/processing-status">
              <Button variant="ghost" size="sm" className="h-6 text-xs gap-1">
                View All
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-violet-50">
              <div className="text-lg font-bold text-violet-700">{status?.active || 0}</div>
              <div className="text-[10px] text-violet-600">Active</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <div className="text-lg font-bold text-slate-700">{status?.pending || 0}</div>
              <div className="text-[10px] text-slate-600">Pending</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-50">
              <div className="text-lg font-bold text-green-700">{status?.completed || 0}</div>
              <div className="text-[10px] text-green-600">Done</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-red-50">
              <div className="text-lg font-bold text-red-700">{status?.failed || 0}</div>
              <div className="text-[10px] text-red-600">Failed</div>
            </div>
          </div>

          {/* Active Jobs */}
          {status?.jobs && status.jobs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recent Activity
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {status.jobs.slice(0, 5).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
                  >
                    <div className="flex-shrink-0">
                      {job.status === 'processing' && (
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      )}
                      {job.status === 'pending' && (
                        <Clock className="h-4 w-4 text-slate-400" />
                      )}
                      {job.status === 'completed' && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {job.status === 'failed' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.contractName || 'Contract'}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {job.stage || job.status}
                      </p>
                    </div>
                    {job.status === 'processing' && (
                      <div className="w-16">
                        <Progress value={job.progress} className="h-1.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {(!status?.jobs || status.jobs.length === 0) && (
            <div className="text-center py-4 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No recent processing activity</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
});

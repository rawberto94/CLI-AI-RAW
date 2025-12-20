'use client';

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Upload,
  Brain,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  XCircle,
  Pencil,
  Share2,
  Shield,
  Bell,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/design-tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

type LifecycleStage = 
  | 'uploaded'
  | 'processing'
  | 'analyzed'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'renewed'
  | 'terminated'
  | 'archived';

interface TimelineStage {
  id: LifecycleStage;
  label: string;
  icon: React.ElementType;
  date?: string;
  status: 'completed' | 'current' | 'upcoming' | 'warning' | 'error';
  description?: string;
}

interface ContractLifecycleTimelineProps {
  uploadDate?: string;
  processingCompleteDate?: string;
  effectiveDate?: string;
  expirationDate?: string;
  terminationDate?: string;
  status: string;
  processingProgress?: number;
  className?: string;
}

export const ContractLifecycleTimeline = memo(function ContractLifecycleTimeline({
  uploadDate,
  processingCompleteDate,
  effectiveDate,
  expirationDate,
  terminationDate,
  status,
  processingProgress = 100,
  className = '',
}: ContractLifecycleTimelineProps) {
  const stages = useMemo(() => {
    const now = new Date();
    const expDate = expirationDate ? new Date(expirationDate) : null;
    const effDate = effectiveDate ? new Date(effectiveDate) : null;
    const daysToExpiry = expDate ? Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
    
    const isProcessing = status === 'processing' || status === 'uploaded';
    const isActive = status === 'completed' || status === 'active';
    const isExpired = expDate && expDate < now;
    const isExpiringSoon = daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 90;
    const isTerminated = status === 'terminated';
    const isArchived = status === 'archived';

    const timeline: TimelineStage[] = [
      {
        id: 'uploaded',
        label: 'Uploaded',
        icon: Upload,
        date: uploadDate,
        status: uploadDate ? 'completed' : 'upcoming',
        description: 'Contract document uploaded',
      },
      {
        id: 'processing',
        label: 'AI Analysis',
        icon: Brain,
        date: processingCompleteDate,
        status: isProcessing ? 'current' : (processingCompleteDate || !isProcessing ? 'completed' : 'upcoming'),
        description: isProcessing ? `Processing ${processingProgress}%` : 'AI extraction complete',
      },
      {
        id: 'active',
        label: 'Active',
        icon: CheckCircle2,
        date: effectiveDate,
        status: isActive && !isExpired && !isExpiringSoon ? 'current' : 
                (effDate && effDate <= now ? 'completed' : 'upcoming'),
        description: effectiveDate ? `Effective from ${formatDate(effectiveDate)}` : 'Contract is active',
      },
    ];

    // Add expiration stage if there's an expiration date
    if (expirationDate) {
      if (isExpired) {
        timeline.push({
          id: 'expired',
          label: 'Expired',
          icon: XCircle,
          date: expirationDate,
          status: 'error',
          description: `Expired on ${formatDate(expirationDate)}`,
        });
      } else if (isExpiringSoon) {
        timeline.push({
          id: 'expiring',
          label: 'Expiring Soon',
          icon: AlertTriangle,
          date: expirationDate,
          status: 'warning',
          description: `${daysToExpiry} days until expiration`,
        });
      } else {
        timeline.push({
          id: 'expiring',
          label: 'Expiration',
          icon: Calendar,
          date: expirationDate,
          status: 'upcoming',
          description: `Expires ${formatDate(expirationDate)}`,
        });
      }
    }

    // Add terminated stage if applicable
    if (isTerminated) {
      timeline.push({
        id: 'terminated',
        label: 'Terminated',
        icon: XCircle,
        date: terminationDate,
        status: 'error',
        description: terminationDate ? `Terminated on ${formatDate(terminationDate)}` : 'Contract terminated',
      });
    }

    // Add archived stage if applicable
    if (isArchived) {
      timeline.push({
        id: 'archived',
        label: 'Archived',
        icon: Archive,
        date: undefined,
        status: 'completed',
        description: 'Contract archived',
      });
    }

    return timeline;
  }, [uploadDate, processingCompleteDate, effectiveDate, expirationDate, terminationDate, status, processingProgress]);

  const getStageColors = (status: TimelineStage['status']) => {
    switch (status) {
      case 'completed':
        return {
          bg: 'bg-emerald-500',
          border: 'border-emerald-500',
          text: 'text-emerald-600',
          line: 'bg-emerald-500',
        };
      case 'current':
        return {
          bg: 'bg-blue-500',
          border: 'border-blue-500',
          text: 'text-blue-600',
          line: 'bg-blue-200',
        };
      case 'warning':
        return {
          bg: 'bg-amber-500',
          border: 'border-amber-500',
          text: 'text-amber-600',
          line: 'bg-amber-200',
        };
      case 'error':
        return {
          bg: 'bg-red-500',
          border: 'border-red-500',
          text: 'text-red-600',
          line: 'bg-red-200',
        };
      default:
        return {
          bg: 'bg-slate-200 dark:bg-slate-700',
          border: 'border-slate-300 dark:border-slate-600',
          text: 'text-slate-400',
          line: 'bg-slate-200 dark:bg-slate-700',
        };
    }
  };

  return (
    <TooltipProvider>
      <div className={cn("relative", className)}>
        {/* Timeline Container */}
        <div className="flex items-center justify-between relative">
          {/* Background Line */}
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-700 -translate-y-1/2" />
          
          {/* Progress Line */}
          <motion.div
            className="absolute left-0 top-1/2 h-0.5 bg-gradient-to-r from-emerald-500 via-blue-500 to-blue-400 -translate-y-1/2"
            initial={{ width: 0 }}
            animate={{ 
              width: `${(stages.filter(s => s.status === 'completed' || s.status === 'current').length / stages.length) * 100}%` 
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {/* Stages */}
          {stages.map((stage, index) => {
            const colors = getStageColors(stage.status);
            const Icon = stage.icon;
            const isLast = index === stages.length - 1;
            const isCurrent = stage.status === 'current';

            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className="relative z-10 flex flex-col items-center"
                  >
                    {/* Stage Dot/Icon */}
                    <motion.div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 bg-white dark:bg-slate-900 transition-all",
                        colors.border,
                        isCurrent && "ring-4 ring-blue-100 dark:ring-blue-900/50"
                      )}
                      animate={isCurrent ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      <Icon className={cn("h-4 w-4", colors.text)} />
                    </motion.div>

                    {/* Label */}
                    <span className={cn(
                      "mt-2 text-xs font-medium text-center max-w-[80px] leading-tight",
                      stage.status === 'upcoming' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                    )}>
                      {stage.label}
                    </span>

                    {/* Pulse Animation for Current */}
                    {isCurrent && (
                      <motion.div
                        className={cn("absolute top-0 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full", colors.bg)}
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      />
                    )}
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent 
                  side="bottom" 
                  className="bg-slate-900 text-white border-slate-700 max-w-[200px]"
                >
                  <div className="text-center">
                    <p className="font-medium">{stage.label}</p>
                    {stage.description && (
                      <p className="text-xs text-slate-400 mt-0.5">{stage.description}</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
});

export default ContractLifecycleTimeline;

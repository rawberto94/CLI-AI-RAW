/**
 * Enhanced Status Badge Component
 * Features: Animated pulse for processing, tooltips, consistent colors
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  FileText,
  Archive,
  Send,
  Eye,
  Edit,
  Pause,
} from 'lucide-react';

export type StatusType = 
  | 'active' | 'ACTIVE'
  | 'processing' | 'PROCESSING'
  | 'completed' | 'COMPLETED'
  | 'pending' | 'PENDING'
  | 'failed' | 'FAILED' | 'error' | 'ERROR'
  | 'draft' | 'DRAFT'
  | 'archived' | 'ARCHIVED'
  | 'review' | 'REVIEW' | 'in_review' | 'IN_REVIEW'
  | 'approved' | 'APPROVED'
  | 'rejected' | 'REJECTED'
  | 'expired' | 'EXPIRED'
  | 'cancelled' | 'CANCELLED'
  | 'paused' | 'PAUSED';

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
  description: string;
  animated?: boolean;
}

const statusConfigs: Record<string, StatusConfig> = {
  active: {
    label: 'Active',
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    description: 'Contract is active and in effect',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    description: 'Document is being analyzed by AI',
    animated: true,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    description: 'Processing completed successfully',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    textColor: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    description: 'Awaiting action or approval',
    animated: true,
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    description: 'Processing failed - please retry',
  },
  error: {
    label: 'Error',
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    description: 'An error occurred',
  },
  draft: {
    label: 'Draft',
    icon: Edit,
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    textColor: 'text-gray-700 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
    description: 'Draft - not yet finalized',
  },
  archived: {
    label: 'Archived',
    icon: Archive,
    bgColor: 'bg-slate-50 dark:bg-slate-900/50',
    textColor: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    description: 'Contract has been archived',
  },
  review: {
    label: 'In Review',
    icon: Eye,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-700 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
    description: 'Under review by team',
    animated: true,
  },
  in_review: {
    label: 'In Review',
    icon: Eye,
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    textColor: 'text-purple-700 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
    description: 'Under review by team',
    animated: true,
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    description: 'Approved and ready',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    description: 'Rejected - see comments',
  },
  expired: {
    label: 'Expired',
    icon: AlertTriangle,
    bgColor: 'bg-orange-50 dark:bg-orange-950/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    description: 'Contract has expired',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
    description: 'Contract was cancelled',
  },
  paused: {
    label: 'Paused',
    icon: Pause,
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    dotColor: 'bg-yellow-500',
    description: 'Processing is paused',
  },
};

export interface EnhancedStatusBadgeProps {
  status: StatusType | string;
  showIcon?: boolean;
  showDot?: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'subtle';
  className?: string;
  customLabel?: string;
}

export function EnhancedStatusBadge({
  status,
  showIcon = true,
  showDot = false,
  showTooltip = true,
  size = 'default',
  variant = 'default',
  className,
  customLabel,
}: EnhancedStatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '_');
  const config = statusConfigs[normalizedStatus] || {
    label: status,
    icon: FileText,
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-gray-200 dark:border-gray-700',
    dotColor: 'bg-gray-400',
    description: `Status: ${status}`,
  };

  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    default: 'text-sm px-2.5 py-1 gap-1.5',
    lg: 'text-base px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const variantClasses = {
    default: cn(config.bgColor, config.textColor, 'border', config.borderColor),
    outline: cn('bg-transparent border-2', config.borderColor, config.textColor),
    subtle: cn(config.bgColor, config.textColor),
  };

  const badge = (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {/* Animated Dot */}
      {showDot && (
        <span className="relative flex h-2 w-2">
          {'animated' in config && config.animated && (
            <motion.span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75',
                config.dotColor
              )}
              animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className={cn('relative inline-flex rounded-full h-2 w-2', config.dotColor)} />
        </span>
      )}

      {/* Icon */}
      {showIcon && (
        <Icon 
          className={cn(
            iconSizes[size],
            'animated' in config && config.animated && 'animate-spin'
          )} 
        />
      )}

      {/* Label */}
      <span>{customLabel || config.label}</span>
    </motion.span>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">{config.label}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Processing Status with Progress
 */
export function ProcessingStatus({
  stage,
  progress,
  estimatedTime,
  className,
}: {
  stage: string;
  progress: number;
  estimatedTime?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn('space-y-2', className)}
    >
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          <span className="font-medium">{stage}</span>
        </div>
        <span className="text-muted-foreground">{progress}%</span>
      </div>
      
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {estimatedTime && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          ~{estimatedTime}s remaining
        </p>
      )}
    </motion.div>
  );
}

export default EnhancedStatusBadge;

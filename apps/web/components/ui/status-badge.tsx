/**
 * StatusBadge Component
 * 
 * A standardized badge for displaying status with consistent styling across the app.
 * Supports multiple status types, custom colors, and optional icons.
 */

'use client';

import * as React from 'react';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  FileText,
  Send,
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Pause,
  Play,
  Archive,
  Eye,
  LucideIcon,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type StatusType =
  // General statuses
  | 'active'
  | 'inactive'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'error'
  | 'success'
  | 'warning'
  | 'info'
  // Contract/Document statuses
  | 'draft'
  | 'review'
  | 'approved'
  | 'rejected'
  | 'signed'
  | 'expired'
  | 'archived'
  // Workflow statuses
  | 'submitted'
  | 'in-progress'
  | 'on-hold'
  | 'cancelled'
  // Risk levels
  | 'low-risk'
  | 'medium-risk'
  | 'high-risk'
  | 'critical';

export interface StatusConfig {
  label: string;
  color: string;
  icon?: LucideIcon;
  pulse?: boolean;
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  /** The status type to display */
  status: StatusType | string;
  /** Override the default label */
  label?: string;
  /** Show icon alongside label */
  showIcon?: boolean;
  /** Icon size in pixels */
  iconSize?: number;
  /** Custom configuration (overrides defaults) */
  config?: Partial<StatusConfig>;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show a pulsing animation for active states */
  animated?: boolean;
}

// ============================================================================
// Status Configuration
// ============================================================================

const statusConfigs: Record<StatusType, StatusConfig> = {
  // General statuses
  active: {
    label: 'Active',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  inactive: {
    label: 'Inactive',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
    icon: Pause,
  },
  pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Clock,
  },
  processing: {
    label: 'Processing',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Loader2,
    pulse: true,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
  success: {
    label: 'Success',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Warning',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertTriangle,
  },
  info: {
    label: 'Info',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: AlertCircle,
  },
  // Contract/Document statuses
  draft: {
    label: 'Draft',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800/30 dark:text-slate-400',
    icon: FileText,
  },
  review: {
    label: 'In Review',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Eye,
  },
  approved: {
    label: 'Approved',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  signed: {
    label: 'Signed',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: CheckCircle2,
  },
  expired: {
    label: 'Expired',
    color: 'bg-gray-200 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400',
    icon: Clock,
  },
  archived: {
    label: 'Archived',
    color: 'bg-slate-200 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
    icon: Archive,
  },
  // Workflow statuses
  submitted: {
    label: 'Submitted',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Send,
  },
  'in-progress': {
    label: 'In Progress',
    color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
    icon: Play,
    pulse: true,
  },
  'on-hold': {
    label: 'On Hold',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Pause,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-gray-200 text-gray-600 dark:bg-gray-700/30 dark:text-gray-400',
    icon: XCircle,
  },
  // Risk levels
  'low-risk': {
    label: 'Low Risk',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: ShieldCheck,
  },
  'medium-risk': {
    label: 'Medium Risk',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: Shield,
  },
  'high-risk': {
    label: 'High Risk',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: ShieldAlert,
  },
  critical: {
    label: 'Critical',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: AlertCircle,
  },
};

// ============================================================================
// Size Configuration
// ============================================================================

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
  lg: 'text-sm px-2.5 py-1.5 gap-2',
};

const iconSizes = {
  sm: 10,
  md: 12,
  lg: 14,
};

// ============================================================================
// Component
// ============================================================================

export function StatusBadge({
  status,
  label,
  showIcon = false,
  iconSize,
  config: customConfig,
  size = 'md',
  animated = true,
  className,
  ...props
}: StatusBadgeProps) {
  // Get config for status (fallback for unknown statuses)
  const defaultConfig: StatusConfig = {
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' '),
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400',
  };

  const baseConfig = statusConfigs[status as StatusType] || defaultConfig;
  const finalConfig = { ...baseConfig, ...customConfig };
  
  const Icon = finalConfig.icon;
  const effectiveIconSize = iconSize ?? iconSizes[size];
  const shouldPulse = animated && finalConfig.pulse;
  const isSpinning = status === 'processing' && animated;

  return (
    <Badge
      className={cn(
        'inline-flex items-center font-medium border-0 rounded-full',
        finalConfig.color,
        sizeClasses[size],
        shouldPulse && 'animate-pulse',
        className
      )}
      {...props}
    >
      {showIcon && Icon && (
        <Icon
          className={cn(
            'flex-shrink-0',
            isSpinning && 'animate-spin'
          )}
          size={effectiveIconSize}
        />
      )}
      <span>{label || finalConfig.label}</span>
    </Badge>
  );
}

// ============================================================================
// Specialized Variants
// ============================================================================

export interface RiskBadgeProps extends Omit<StatusBadgeProps, 'status'> {
  /** Risk score from 0-100 */
  score: number;
  /** Show numeric score */
  showScore?: boolean;
}

/**
 * Specialized badge for displaying risk levels based on a numeric score
 */
export function RiskBadge({ score, showScore = false, label, ...props }: RiskBadgeProps) {
  const getRiskStatus = (): StatusType => {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'high-risk';
    if (score >= 40) return 'medium-risk';
    return 'low-risk';
  };

  const status = getRiskStatus();
  const displayLabel = label || (showScore 
    ? `${statusConfigs[status].label} (${score}%)`
    : statusConfigs[status].label);

  return <StatusBadge status={status} label={displayLabel} showIcon {...props} />;
}

/**
 * Specialized badge for contract statuses with appropriate icons
 */
export function ContractStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, 'showIcon'>) {
  return <StatusBadge status={status} showIcon {...props} />;
}

/**
 * Specialized badge for approval workflow statuses
 */
export function ApprovalStatusBadge({
  status,
  ...props
}: Omit<StatusBadgeProps, 'showIcon'>) {
  return <StatusBadge status={status} showIcon {...props} />;
}

// ============================================================================
// Utility: Get status from risk score
// ============================================================================

export function getRiskStatusFromScore(score: number): StatusType {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high-risk';
  if (score >= 40) return 'medium-risk';
  return 'low-risk';
}

// ============================================================================
// Hook for status configuration
// ============================================================================

export function useStatusConfig(status: StatusType | string): StatusConfig {
  return React.useMemo(() => {
    const defaultConfig: StatusConfig = {
      label: status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' '),
      color: 'bg-gray-100 text-gray-800',
    };
    return statusConfigs[status as StatusType] || defaultConfig;
  }, [status]);
}

/**
 * Contract Status Badge Component
 * Visual indicators for contract lifecycle and status
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { 
  FilePlus, 
  Archive, 
  FileEdit, 
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  FileCheck,
  Trash2,
  Pause
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ContractStatus = 
  | 'DRAFT' 
  | 'UPLOADED' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'PENDING' 
  | 'ACTIVE' 
  | 'FAILED' 
  | 'ARCHIVED' 
  | 'DELETED' 
  | 'EXPIRED' 
  | 'CANCELLED';

type DocumentRole = 'NEW_CONTRACT' | 'EXISTING' | 'AMENDMENT' | 'RENEWAL' | null;

interface ContractStatusBadgeProps {
  status?: ContractStatus | string | null;
  documentRole?: DocumentRole | string | null;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<string, {
  label: string;
  icon: any;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  // Workflow/Approval States
  DRAFT: {
    label: 'Draft',
    icon: FilePlus,
    variant: 'secondary',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  PENDING: {
    label: 'Pending Approval',
    icon: Clock,
    variant: 'default',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  
  // Processing States
  UPLOADED: {
    label: 'Uploaded',
    icon: FileCheck,
    variant: 'secondary',
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  PROCESSING: {
    label: 'Processing',
    icon: Loader2,
    variant: 'default',
    className: 'bg-violet-100 text-violet-700 border-violet-200 animate-pulse',
  },
  COMPLETED: {
    label: 'Processed',
    icon: CheckCircle,
    variant: 'outline',
    className: 'bg-green-50 text-green-700 border-green-300',
  },
  
  // Active States
  ACTIVE: {
    label: 'Active',
    icon: CheckCircle,
    variant: 'default',
    className: 'bg-green-100 text-green-700 border-green-200',
  },
  
  // Error/Terminal States
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  EXPIRED: {
    label: 'Expired',
    icon: AlertTriangle,
    variant: 'outline',
    className: 'bg-orange-50 text-orange-700 border-orange-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    variant: 'outline',
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  },
  ARCHIVED: {
    label: 'Archived',
    icon: Archive,
    variant: 'outline',
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  },
  DELETED: {
    label: 'Deleted',
    icon: Trash2,
    variant: 'outline',
    className: 'bg-slate-100 text-slate-500 border-slate-300',
  },
};

const roleConfig: Record<string, {
  label: string;
  icon: any;
  className: string;
}> = {
  NEW_CONTRACT: {
    label: 'New',
    icon: FilePlus,
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  AMENDMENT: {
    label: 'Amendment',
    icon: FileEdit,
    className: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  RENEWAL: {
    label: 'Renewal',
    icon: RefreshCw,
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  EXISTING: {
    label: 'Existing',
    icon: Archive,
    className: 'bg-slate-100 text-slate-600 border-slate-300',
  },
};

export function ContractStatusBadge({ 
  status, 
  documentRole,
  className,
  showIcon = true,
  size = 'md'
}: ContractStatusBadgeProps) {
  const config = status ? statusConfig[status.toUpperCase()] : null;
  const roleConf = documentRole ? roleConfig[documentRole.toUpperCase()] : null;
  
  if (!config && !roleConf) return null;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  // Show both badges if both exist
  if (config && roleConf) {
    return (
      <div className="flex items-center gap-1.5">
        <Badge
          variant={config.variant}
          className={cn(
            'inline-flex items-center font-medium border',
            sizeClasses[size],
            config.className,
            className
          )}
        >
          {showIcon && config.icon && (
            <config.icon className={cn(
              iconSizes[size],
              status === 'PROCESSING' && 'animate-spin'
            )} />
          )}
          {config.label}
        </Badge>
        
        <Badge
          variant="outline"
          className={cn(
            'inline-flex items-center font-medium border',
            sizeClasses[size],
            roleConf.className
          )}
        >
          {showIcon && roleConf.icon && (
            <roleConf.icon className={iconSizes[size]} />
          )}
          {roleConf.label}
        </Badge>
      </div>
    );
  }

  // Show status badge
  if (config) {
    const Icon = config.icon;
    
    return (
      <Badge
        variant={config.variant}
        className={cn(
          'inline-flex items-center font-medium border',
          sizeClasses[size],
          config.className,
          className
        )}
      >
        {showIcon && Icon && (
          <Icon className={cn(
            iconSizes[size],
            status === 'PROCESSING' && 'animate-spin'
          )} />
        )}
        {config.label}
      </Badge>
    );
  }

  // Show role badge
  if (roleConf) {
    const Icon = roleConf.icon;
    
    return (
      <Badge
        variant="outline"
        className={cn(
          'inline-flex items-center font-medium border',
          sizeClasses[size],
          roleConf.className,
          className
        )}
      >
        {showIcon && Icon && <Icon className={iconSizes[size]} />}
        {roleConf.label}
      </Badge>
    );
  }

  return null;
}

/**
 * Compact status indicator (just colored dot)
 */
export function ContractStatusDot({ 
  status,
  className 
}: { 
  status?: ContractStatus | string | null;
  className?: string;
}) {
  const config = status ? statusConfig[status.toUpperCase()] : null;
  if (!config) return null;

  const dotColors: Record<string, string> = {
    DRAFT: 'bg-violet-500',
    PENDING: 'bg-amber-500',
    UPLOADED: 'bg-violet-500',
    PROCESSING: 'bg-violet-500 animate-pulse',
    COMPLETED: 'bg-green-500',
    ACTIVE: 'bg-green-500',
    FAILED: 'bg-red-500',
    EXPIRED: 'bg-orange-500',
    CANCELLED: 'bg-slate-400',
    ARCHIVED: 'bg-slate-400',
    DELETED: 'bg-slate-300',
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <div className={cn('h-2 w-2 rounded-full', dotColors[status?.toUpperCase() ?? ''])} />
      <span className="text-xs text-slate-600">{config.label}</span>
    </div>
  );
}

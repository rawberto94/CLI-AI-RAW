/**
 * Contract Quick Actions Component
 * 
 * Quick action buttons and menus for individual contracts.
 */

'use client';

import React, { memo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Pencil,
  Download,
  Share2,
  Trash2,
  Brain,
  ClipboardCheck,
  MoreHorizontal,
  ExternalLink,
  Copy,
  Sparkles,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ContractQuickActionsProps {
  contractId: string;
  contractTitle?: string;
  onView?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  onApproval?: () => void;
  onGenerateArtifacts?: () => void;
  onCopy?: () => void;
  onNotify?: () => void;
  hasArtifacts?: boolean;
  showLabels?: boolean;
  variant?: 'icon' | 'compact' | 'full';
  className?: string;
}

export interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  showLabel?: boolean;
}

// ============================================================================
// Sub-components
// ============================================================================

const QuickActionButton = memo(function QuickActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
  showLabel = false,
}: QuickActionButtonProps) {
  if (showLabel) {
    return (
      <Button
        variant={variant === 'destructive' ? 'destructive' : 'outline'}
        size="sm"
        className="gap-2"
        onClick={onClick}
        disabled={disabled}
      >
        {icon}
        {label}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8',
            variant === 'destructive' && 'text-destructive hover:text-destructive hover:bg-destructive/10'
          )}
          onClick={onClick}
          disabled={disabled}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
});

// ============================================================================
// Main Component: Icon Actions
// ============================================================================

export const ContractQuickActionsIcon = memo(function ContractQuickActionsIcon({
  contractId,
  onView,
  onShare,
  onDelete,
  onDownload,
  onGenerateArtifacts,
  hasArtifacts,
  className,
}: ContractQuickActionsProps) {
  const router = useRouter();

  const handleView = () => {
    if (onView) {
      onView();
    } else {
      router.push(`/contracts/${contractId}`);
    }
  };

  const handleAI = () => {
    router.push(`/contracts/${contractId}?tab=ai`);
  };

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1', className)}>
        <QuickActionButton
          icon={<Eye className="h-4 w-4" />}
          label="View"
          onClick={handleView}
        />
        <QuickActionButton
          icon={<Brain className="h-4 w-4" />}
          label="AI Analysis"
          onClick={handleAI}
        />
        {onShare && (
          <QuickActionButton
            icon={<Share2 className="h-4 w-4" />}
            label="Share"
            onClick={onShare}
          />
        )}
        {onDownload && (
          <QuickActionButton
            icon={<Download className="h-4 w-4" />}
            label="Download"
            onClick={onDownload}
          />
        )}
        {onGenerateArtifacts && !hasArtifacts && (
          <QuickActionButton
            icon={<Sparkles className="h-4 w-4" />}
            label="Generate AI Artifacts"
            onClick={onGenerateArtifacts}
          />
        )}
      </div>
    </TooltipProvider>
  );
});

// ============================================================================
// Main Component: Dropdown Menu
// ============================================================================

export const ContractQuickActionsMenu = memo(function ContractQuickActionsMenu({
  contractId,
  contractTitle,
  onView,
  onEdit,
  onShare,
  onDelete,
  onDownload,
  onApproval,
  onGenerateArtifacts,
  onCopy,
  onNotify,
  hasArtifacts,
  className,
}: ContractQuickActionsProps) {
  const router = useRouter();

  const handleView = () => {
    if (onView) {
      onView();
    } else {
      router.push(`/contracts/${contractId}`);
    }
  };

  const handleViewNewTab = () => {
    window.open(`/contracts/${contractId}`, '_blank');
  };

  const handleAI = () => {
    router.push(`/contracts/${contractId}?tab=ai`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('h-8 w-8', className)}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {contractTitle && (
          <>
            <DropdownMenuLabel className="truncate font-normal text-xs text-muted-foreground">
              {contractTitle}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={handleView}>
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewNewTab}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Tab
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleAI}>
          <Brain className="h-4 w-4 mr-2" />
          AI Analysis
        </DropdownMenuItem>
        
        {(onEdit || onShare || onDownload || onCopy) && (
          <>
            <DropdownMenuSeparator />
            
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            
            {onShare && (
              <DropdownMenuItem onClick={onShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
            )}
            
            {onDownload && (
              <DropdownMenuItem onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            )}
            
            {onCopy && (
              <DropdownMenuItem onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {(onApproval || onNotify || onGenerateArtifacts) && (
          <>
            <DropdownMenuSeparator />
            
            {onApproval && (
              <DropdownMenuItem onClick={onApproval}>
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Request Approval
              </DropdownMenuItem>
            )}
            
            {onNotify && (
              <DropdownMenuItem onClick={onNotify}>
                <Bell className="h-4 w-4 mr-2" />
                Set Reminder
              </DropdownMenuItem>
            )}
            
            {onGenerateArtifacts && !hasArtifacts && (
              <DropdownMenuItem onClick={onGenerateArtifacts}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Artifacts
              </DropdownMenuItem>
            )}
          </>
        )}
        
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ============================================================================
// Combined Component
// ============================================================================

export const ContractQuickActions = memo(function ContractQuickActions({
  variant = 'icon',
  ...props
}: ContractQuickActionsProps) {
  if (variant === 'full') {
    return (
      <div className="flex items-center gap-2">
        <ContractQuickActionsIcon {...props} />
        <ContractQuickActionsMenu {...props} />
      </div>
    );
  }
  
  if (variant === 'compact') {
    return <ContractQuickActionsMenu {...props} />;
  }
  
  return <ContractQuickActionsIcon {...props} />;
});

export default ContractQuickActions;

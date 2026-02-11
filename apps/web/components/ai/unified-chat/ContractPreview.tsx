'use client';

/**
 * Contract Preview Card
 * 
 * Rich preview cards for contracts mentioned in chat.
 * Shows key metadata, status, and quick actions.
 * 
 * Consolidated from FloatingAIBubble contract preview rendering.
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Calendar,
  DollarSign,
  User,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContractPreviewData {
  id: string;
  contractTitle?: string;
  supplierName?: string;
  status?: string;
  totalValue?: number;
  expirationDate?: Date | string;
  contractType?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  signatureStatus?: string;
  relevanceScore?: number;
}

interface ContractPreviewProps {
  contract: ContractPreviewData;
  onClick?: (id: string) => void;
  variant?: 'compact' | 'full';
  showRelevance?: boolean;
  className?: string;
}

// Format currency
function formatCurrency(value: number | undefined): string {
  if (!value) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// Format date
function formatDate(date: Date | string | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Get status color
function getStatusColor(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'PENDING':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'EXPIRED':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
}

// Get risk icon
function RiskIcon({ level }: { level?: string }) {
  switch (level) {
    case 'high':
      return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    case 'medium':
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    case 'low':
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    default:
      return null;
  }
}

export const ContractPreviewCard = memo(function ContractPreviewCard({
  contract,
  onClick,
  variant = 'full',
  showRelevance = false,
  className,
}: ContractPreviewProps) {
  const isCompact = variant === 'compact';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'group relative rounded-lg border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800',
        'transition-all duration-200 cursor-pointer overflow-hidden',
        isCompact ? 'p-3' : 'p-4',
        className
      )}
      onClick={() => onClick?.(contract.id)}
    >
      {/* Relevance indicator */}
      {showRelevance && contract.relevanceScore !== undefined && (
        <div
          className="absolute top-0 left-0 h-1 bg-gradient-to-r from-violet-500 to-purple-500"
          style={{ width: `${contract.relevanceScore * 100}%` }}
        />
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={cn(
            'p-1.5 rounded-md bg-violet-100 dark:bg-violet-900/30',
            isCompact && 'p-1'
          )}>
            <FileText className={cn(
              'text-violet-600 dark:text-violet-400',
              isCompact ? 'h-3 w-3' : 'h-4 w-4'
            )} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className={cn(
              'font-medium text-slate-900 dark:text-slate-100 truncate',
              isCompact ? 'text-sm' : 'text-base'
            )}>
              {contract.contractTitle || 'Untitled Contract'}
            </h4>
            {!isCompact && contract.contractType && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {contract.contractType}
              </p>
            )}
          </div>
        </div>
        
        {/* Status badge */}
        {contract.status && (
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
            getStatusColor(contract.status)
          )}>
            {contract.status}
          </span>
        )}
      </div>
      
      {/* Metadata */}
      <div className={cn(
        'grid gap-2 text-sm',
        isCompact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'
      )}>
        {/* Supplier */}
        {contract.supplierName && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{contract.supplierName}</span>
          </div>
        )}
        
        {/* Value */}
        {contract.totalValue !== undefined && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formatCurrency(contract.totalValue)}</span>
          </div>
        )}
        
        {/* Expiration */}
        {contract.expirationDate && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formatDate(contract.expirationDate)}</span>
          </div>
        )}
        
        {/* Risk level */}
        {contract.riskLevel && !isCompact && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <RiskIcon level={contract.riskLevel} />
            <span className="capitalize">{contract.riskLevel} risk</span>
          </div>
        )}
      </div>
      
      {/* Hover indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
    </motion.div>
  );
});

// Contract list component
export interface ContractListProps {
  contracts: ContractPreviewData[];
  onContractClick?: (id: string) => void;
  variant?: 'compact' | 'full';
  showRelevance?: boolean;
  maxItems?: number;
  className?: string;
  emptyMessage?: string;
}

export const ContractPreviewList = memo(function ContractPreviewList({
  contracts,
  onContractClick,
  variant = 'compact',
  showRelevance = false,
  maxItems = 5,
  className,
  emptyMessage = 'No contracts found',
}: ContractListProps) {
  const displayContracts = contracts.slice(0, maxItems);
  const remaining = contracts.length - maxItems;
  
  if (contracts.length === 0) {
    return (
      <div className={cn(
        'text-sm text-slate-500 dark:text-slate-400 italic py-4 text-center',
        className
      )}>
        {emptyMessage}
      </div>
    );
  }
  
  return (
    <div className={cn('space-y-2', className)}>
      {displayContracts.map((contract) => (
        <ContractPreviewCard
          key={contract.id}
          contract={contract}
          onClick={onContractClick}
          variant={variant}
          showRelevance={showRelevance}
        />
      ))}
      
      {remaining > 0 && (
        <button
          className="w-full py-2 text-sm text-violet-600 dark:text-violet-400 hover:underline flex items-center justify-center gap-1"
          onClick={() => onContractClick?.('view-all')}
        >
          <span>View {remaining} more contracts</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export default ContractPreviewCard;

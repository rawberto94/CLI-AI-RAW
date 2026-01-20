'use client';

import { memo, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Building2,
  DollarSign,
  Clock,
  Shield,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Eye,
  Brain,
  Tag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Contract } from '@/hooks/use-queries';

interface ContractHoverPreviewProps {
  contract: Contract;
  children: ReactNode;
  onView?: () => void;
  onAnalyze?: () => void;
  disabled?: boolean;
  side?: 'left' | 'right' | 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  delay?: number;
}

const formatCurrency = (value?: number) => {
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (date?: string) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getDaysUntilExpiry = (date?: string) => {
  if (!date) return null;
  const now = new Date();
  const expiry = new Date(date);
  const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
};

const getStatusConfig = (status: string) => {
  const configs: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    completed: { label: 'Active', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Loader2 },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  };
  return configs[status] || { label: status, color: 'bg-slate-100 text-slate-700 border-slate-200', icon: FileText };
};

const getRiskLevel = (score?: number) => {
  if (score === undefined || score === null) return null;
  if (score >= 70) return { level: 'High', color: 'text-red-600 bg-red-50', icon: AlertTriangle };
  if (score >= 40) return { level: 'Medium', color: 'text-amber-600 bg-amber-50', icon: Shield };
  return { level: 'Low', color: 'text-emerald-600 bg-emerald-50', icon: Shield };
};

export const ContractHoverPreview = memo(function ContractHoverPreview({
  contract,
  children,
  onView,
  onAnalyze,
  disabled = false,
  side = 'right',
  align = 'start',
  delay = 400,
}: ContractHoverPreviewProps) {
  const [_isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovered(true);
    timeoutRef.current = setTimeout(() => {
      setShowPreview(true);
    }, delay);
  }, [disabled, delay]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowPreview(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const statusConfig = getStatusConfig(contract.status);
  const StatusIcon = statusConfig.icon;
  const daysUntilExpiry = getDaysUntilExpiry(contract.expirationDate);
  const riskLevel = getRiskLevel(contract.riskScore);

  const getPositionClasses = () => {
    const positions = {
      right: 'left-full ml-2',
      left: 'right-full mr-2',
      top: 'bottom-full mb-2',
      bottom: 'top-full mt-2',
    };
    const alignments = {
      start: side === 'left' || side === 'right' ? 'top-0' : 'left-0',
      center: side === 'left' || side === 'right' ? 'top-1/2 -translate-y-1/2' : 'left-1/2 -translate-x-1/2',
      end: side === 'left' || side === 'right' ? 'bottom-0' : 'right-0',
    };
    return `${positions[side]} ${alignments[align]}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-[200px]"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: side === 'bottom' ? -5 : side === 'top' ? 5 : 0, x: side === 'right' ? -5 : side === 'left' ? 5 : 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 w-80',
              getPositionClasses()
            )}
          >
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-850 p-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md flex-shrink-0">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                        {contract.title || 'Untitled Contract'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {contract.type || 'Contract'}
                      </p>
                    </div>
                  </div>
                  <Badge className={cn('text-[10px] px-1.5 py-0.5 border', statusConfig.color)}>
                    <StatusIcon className={cn('h-3 w-3 mr-1', contract.status === 'processing' && 'animate-spin')} />
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 space-y-3">
                {/* Party */}
                {(contract.parties?.client || contract.parties?.supplier) && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    <span className="text-slate-600 dark:text-slate-300 truncate">
                      {contract.parties.client || contract.parties.supplier}
                    </span>
                  </div>
                )}

                {/* Value & Risk */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className={cn(
                      'font-semibold',
                      contract.value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                    )}>
                      {formatCurrency(contract.value)}
                    </span>
                  </div>
                  {riskLevel && (
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium',
                      riskLevel.color
                    )}>
                      <riskLevel.icon className="h-3 w-3" />
                      {riskLevel.level} Risk
                    </div>
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Created</span>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">
                      {formatDate(contract.createdAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Expires</span>
                    <p className={cn(
                      'font-medium',
                      daysUntilExpiry !== null && daysUntilExpiry < 0 && 'text-red-600',
                      daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 30 && 'text-amber-600',
                      (daysUntilExpiry === null || daysUntilExpiry > 30) && 'text-slate-600 dark:text-slate-300'
                    )}>
                      {formatDate(contract.expirationDate)}
                      {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
                        <span className="text-red-500 text-[10px] block">Expired</span>
                      )}
                      {daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && (
                        <span className="text-amber-500 text-[10px] block">{daysUntilExpiry}d left</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Category */}
                {contract.category && (
                  <div className="flex items-center gap-2 text-xs">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <span
                      className="px-2 py-0.5 rounded-md font-medium"
                      style={{
                        backgroundColor: `${contract.category.color}20`,
                        color: contract.category.color,
                      }}
                    >
                      {contract.category.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView?.();
                  }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAnalyze?.();
                  }}
                >
                  <Brain className="h-3.5 w-3.5 mr-1.5" />
                  AI Analysis
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ContractHoverPreview;

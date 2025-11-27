/**
 * Enhanced Contract Card Component
 * Modern, interactive contract card with animations and rich info display
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EnhancedStatusBadge } from '@/components/ui/enhanced-status-badge';
import { ProgressBar } from '@/components/ui/enhanced-progress';
import {
  FileText,
  Calendar,
  DollarSign,
  Users,
  AlertTriangle,
  Eye,
  MoreHorizontal,
  Star,
  Download,
  Share2,
  Trash2,
  Edit,
  Clock,
  Building2,
  TrendingUp,
  Shield,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface ContractCardProps {
  id: string;
  title: string;
  status: 'completed' | 'processing' | 'pending' | 'failed' | 'draft';
  parties?: {
    client?: string;
    supplier?: string;
  };
  value?: number;
  effectiveDate?: string;
  expirationDate?: string;
  riskScore?: number;
  uploadedAt?: string;
  type?: string;
  tags?: string[];
  isFavorite?: boolean;
  processing?: {
    progress: number;
    currentStage: string;
  };
  error?: string;
  aiInsights?: {
    count: number;
    highlight?: string;
  };
  onClick?: () => void;
  onFavorite?: (id: string) => void;
  onDelete?: (id: string) => void;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export function EnhancedContractCard({
  id,
  title,
  status,
  parties,
  value,
  effectiveDate,
  expirationDate,
  riskScore,
  uploadedAt,
  type,
  tags = [],
  isFavorite = false,
  processing,
  error,
  aiInsights,
  onClick,
  onFavorite,
  onDelete,
  variant = 'default',
  className
}: ContractCardProps) {
  const [showActions, setShowActions] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilExpiry = () => {
    if (!expirationDate) return null;
    const days = Math.ceil(
      (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const daysUntilExpiry = getDaysUntilExpiry();
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;

  const getRiskColor = () => {
    if (!riskScore) return null;
    if (riskScore < 30) return 'text-green-600 bg-green-50';
    if (riskScore < 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className={cn(
          'group flex items-center gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-md transition-all cursor-pointer',
          className
        )}
        onClick={onClick}
      >
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{title}</p>
          <p className="text-sm text-gray-500 truncate">{parties?.client || parties?.supplier}</p>
        </div>
        <EnhancedStatusBadge status={status === 'completed' ? 'active' : status} size="sm" />
        <Link href={`/contracts/${id}`} onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
            <Eye className="h-4 w-4" />
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      className={cn('transform-gpu', className)}
    >
      <Card
        className={cn(
          'relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-900',
          isExpiringSoon && 'ring-2 ring-amber-400/50',
          isExpired && 'ring-2 ring-red-400/50',
          status === 'failed' && 'ring-2 ring-red-400/50'
        )}
        onClick={onClick}
      >
        {/* Accent bar */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-1',
          status === 'completed' && 'bg-gradient-to-r from-green-400 to-emerald-500',
          status === 'processing' && 'bg-gradient-to-r from-blue-400 to-indigo-500',
          status === 'pending' && 'bg-gradient-to-r from-amber-400 to-orange-500',
          status === 'failed' && 'bg-gradient-to-r from-red-400 to-rose-500',
          status === 'draft' && 'bg-gradient-to-r from-gray-300 to-gray-400'
        )} />

        <CardContent className="pt-6 pb-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl shadow-sm">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate text-lg">
                  {title}
                </h3>
                {type && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{type}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <EnhancedStatusBadge 
                status={status === 'completed' ? 'active' : status} 
                animated={status === 'processing'}
              />
              
              {/* Quick actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: showActions ? 1 : 0 }}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite?.(id);
                  }}
                >
                  <Star className={cn(
                    'h-4 w-4',
                    isFavorite ? 'fill-amber-400 text-amber-400' : 'text-gray-400'
                  )} />
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Parties */}
          {(parties?.client || parties?.supplier) && (
            <div className="flex items-center gap-4 mb-4 text-sm">
              {parties.client && (
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Building2 className="h-4 w-4" />
                  <span className="truncate max-w-[120px]">{parties.client}</span>
                </div>
              )}
              {parties.supplier && (
                <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                  <Users className="h-4 w-4" />
                  <span className="truncate max-w-[120px]">{parties.supplier}</span>
                </div>
              )}
            </div>
          )}

          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {value !== undefined && value > 0 && (
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Value
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {formatCurrency(value)}
                </p>
              </div>
            )}
            
            {expirationDate && (
              <div className={cn(
                'p-2.5 rounded-lg',
                isExpiringSoon ? 'bg-amber-50 dark:bg-amber-900/20' :
                isExpired ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-gray-50 dark:bg-gray-800/50'
              )}>
                <p className={cn(
                  'text-xs flex items-center gap-1',
                  isExpiringSoon ? 'text-amber-600' :
                  isExpired ? 'text-red-600' :
                  'text-gray-500'
                )}>
                  <Calendar className="h-3 w-3" />
                  Expires
                </p>
                <p className={cn(
                  'text-sm font-semibold mt-0.5',
                  isExpiringSoon ? 'text-amber-700 dark:text-amber-400' :
                  isExpired ? 'text-red-700 dark:text-red-400' :
                  'text-gray-900 dark:text-gray-100'
                )}>
                  {formatDate(expirationDate)}
                </p>
              </div>
            )}

            {riskScore !== undefined && (
              <div className={cn('p-2.5 rounded-lg', getRiskColor())}>
                <p className="text-xs flex items-center gap-1 opacity-80">
                  <Shield className="h-3 w-3" />
                  Risk
                </p>
                <p className="text-sm font-semibold mt-0.5">
                  {riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High'}
                </p>
              </div>
            )}
          </div>

          {/* Processing State */}
          {status === 'processing' && processing && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  {processing.currentStage}
                </span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {processing.progress}%
                </span>
              </div>
              <ProgressBar value={processing.progress} variant="gradient" size="sm" />
            </div>
          )}

          {/* Error State */}
          {status === 'failed' && error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                    Processing Failed
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {aiInsights && (
            <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-100">
                  {aiInsights.count} AI Insight{aiInsights.count !== 1 ? 's' : ''}
                </span>
              </div>
              {aiInsights.highlight && (
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                  {aiInsights.highlight}
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tags.slice(0, 3).map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                  {tag}
                </Badge>
              ))}
              {tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
            {uploadedAt && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Added {formatDate(uploadedAt)}
              </span>
            )}
            <Link href={`/contracts/${id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Eye className="h-4 w-4" />
                View
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default EnhancedContractCard;

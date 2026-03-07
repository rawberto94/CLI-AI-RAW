'use client';

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Shield,
  Zap,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface QuickStat {
  id: string;
  label: string;
  value: number | string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  highlight?: boolean;
  onClick?: () => void;
}

interface QuickStatsBarProps {
  stats: QuickStat[];
  className?: string;
  compact?: boolean;
}

const colorConfig = {
  blue: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    icon: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-900 dark:text-violet-100',
    highlight: 'ring-violet-500/20',
  },
  green: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    icon: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-900 dark:text-violet-100',
    highlight: 'ring-violet-500/20',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-900 dark:text-amber-100',
    highlight: 'ring-amber-500/20',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-900 dark:text-red-100',
    highlight: 'ring-red-500/20',
  },
  purple: {
    bg: 'bg-violet-50 dark:bg-violet-950/30',
    border: 'border-violet-200 dark:border-violet-800',
    icon: 'text-violet-600 dark:text-violet-400',
    text: 'text-violet-900 dark:text-violet-100',
    highlight: 'ring-violet-500/20',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
    text: 'text-slate-900 dark:text-slate-100',
    highlight: 'ring-slate-500/20',
  },
};

const QuickStatItem = memo(function QuickStatItem({
  stat,
  compact,
  index,
}: {
  stat: QuickStat;
  compact?: boolean;
  index: number;
}) {
  const config = colorConfig[stat.color];
  const Icon = stat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={stat.onClick}
            disabled={!stat.onClick}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200',
              config.bg,
              config.border,
              stat.onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
              stat.highlight && `ring-2 ${config.highlight}`,
              compact ? 'gap-1.5 px-2 py-1.5' : 'gap-2 px-3 py-2'
            )}
          >
            <div
              className={cn(
                'flex-shrink-0 rounded-md flex items-center justify-center',
                compact ? 'p-1' : 'p-1.5',
                config.bg
              )}
            >
              <Icon className={cn(config.icon, compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            </div>

            <div className="flex flex-col items-start min-w-0">
              <span
                className={cn(
                  'font-semibold tabular-nums',
                  config.text,
                  compact ? 'text-sm' : 'text-base'
                )}
              >
                {stat.value}
              </span>
              <span
                className={cn(
                  'text-slate-500 dark:text-slate-400 truncate',
                  compact ? 'text-[10px]' : 'text-xs'
                )}
              >
                {stat.label}
              </span>
            </div>

            {stat.trend && stat.trendValue && (
              <div
                className={cn(
                  'flex items-center gap-0.5 ml-1',
                  stat.trend === 'up' && 'text-violet-600',
                  stat.trend === 'down' && 'text-red-600',
                  stat.trend === 'neutral' && 'text-slate-500'
                )}
              >
                {stat.trend === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : stat.trend === 'down' ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                <span className="text-[10px] font-medium">{stat.trendValue}</span>
              </div>
            )}

            {stat.onClick && (
              <ArrowRight
                className={cn(
                  'h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-auto',
                  config.icon
                )}
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {stat.onClick ? `Click to filter by ${stat.label.toLowerCase()}` : stat.label}
        </TooltipContent>
      </Tooltip>
    </motion.div>
  );
});

export const QuickStatsBar = memo(function QuickStatsBar({
  stats,
  className = '',
  compact = false,
}: QuickStatsBarProps) {
  if (stats.length === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700',
        className
      )}
    >
      <AnimatePresence mode="popLayout">
        {stats.map((stat, index) => (
          <QuickStatItem key={stat.id} stat={stat} compact={compact} index={index} />
        ))}
      </AnimatePresence>
    </div>
  );
});

// Pre-built stat generators for common use cases
export function generateContractStats(data: {
  total: number;
  totalValue: number;
  expiringSoon: number;
  highRisk: number;
  processing: number;
  recentlyAdded: number;
  onFilterClick?: (filter: string) => void;
}): QuickStat[] {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return [
    {
      id: 'total',
      label: 'Total Contracts',
      value: data.total,
      icon: FileText,
      color: 'blue',
      onClick: data.onFilterClick ? () => data.onFilterClick?.('all') : undefined,
    },
    {
      id: 'value',
      label: 'Total Value',
      value: formatCurrency(data.totalValue),
      icon: DollarSign,
      color: 'green',
    },
    ...(data.expiringSoon > 0
      ? [
          {
            id: 'expiring',
            label: 'Expiring Soon',
            value: data.expiringSoon,
            icon: Clock,
            color: 'amber' as const,
            highlight: data.expiringSoon >= 5,
            onClick: data.onFilterClick ? () => data.onFilterClick?.('expiring') : undefined,
          },
        ]
      : []),
    ...(data.highRisk > 0
      ? [
          {
            id: 'high-risk',
            label: 'High Risk',
            value: data.highRisk,
            icon: Shield,
            color: 'red' as const,
            highlight: data.highRisk >= 3,
            onClick: data.onFilterClick ? () => data.onFilterClick?.('high-risk') : undefined,
          },
        ]
      : []),
    ...(data.processing > 0
      ? [
          {
            id: 'processing',
            label: 'Processing',
            value: data.processing,
            icon: Zap,
            color: 'purple' as const,
            onClick: data.onFilterClick ? () => data.onFilterClick?.('processing') : undefined,
          },
        ]
      : []),
    ...(data.recentlyAdded > 0
      ? [
          {
            id: 'recent',
            label: 'Added This Week',
            value: data.recentlyAdded,
            icon: Sparkles,
            color: 'slate' as const,
            onClick: data.onFilterClick ? () => data.onFilterClick?.('recent') : undefined,
          },
        ]
      : []),
  ];
}

export default QuickStatsBar;

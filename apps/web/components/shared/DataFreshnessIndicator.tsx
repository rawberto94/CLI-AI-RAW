/**
 * Data Freshness Indicator
 * 
 * Shows when data is stale and being refreshed in the background.
 * Provides visual feedback for stale-while-revalidate patterns.
 */

'use client';

import { memo, useMemo } from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DataFreshnessProps {
  /** When the data was last fetched */
  dataUpdatedAt?: number | Date;
  /** Is data currently being fetched */
  isFetching?: boolean;
  /** Is data considered stale */
  isStale?: boolean;
  /** Is there an error */
  isError?: boolean;
  /** Show as inline badge or full text */
  variant?: 'badge' | 'text' | 'icon' | 'minimal';
  /** Size of the indicator */
  size?: 'sm' | 'md';
  /** Custom className */
  className?: string;
  /** Callback when clicked (usually to refetch) */
  onRefresh?: () => void;
}

export const DataFreshnessIndicator = memo(function DataFreshnessIndicator({
  dataUpdatedAt,
  isFetching = false,
  isStale = false,
  isError = false,
  variant = 'badge',
  size = 'sm',
  className,
  onRefresh,
}: DataFreshnessProps) {
  const lastUpdated = useMemo(() => {
    if (!dataUpdatedAt) return null;
    const date = dataUpdatedAt instanceof Date ? dataUpdatedAt : new Date(dataUpdatedAt);
    return formatDistanceToNow(date, { addSuffix: true });
  }, [dataUpdatedAt]);

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  // Determine state
  const state = useMemo(() => {
    if (isError) return 'error';
    if (isFetching) return 'fetching';
    if (isStale) return 'stale';
    return 'fresh';
  }, [isError, isFetching, isStale]);

  const stateConfig = {
    error: {
      icon: AlertCircle,
      label: 'Error loading data',
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    fetching: {
      icon: RefreshCw,
      label: 'Refreshing...',
      color: 'text-violet-500',
      bgColor: 'bg-violet-50',
      borderColor: 'border-violet-200',
    },
    stale: {
      icon: Clock,
      label: 'Updating...',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    fresh: {
      icon: CheckCircle2,
      label: 'Up to date',
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
  };

  const config = stateConfig[state];
  const Icon = config.icon;

  // Minimal variant - just a pulsing dot
  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-block w-2 h-2 rounded-full',
                state === 'error' && 'bg-red-500',
                state === 'fetching' && 'bg-violet-500 animate-pulse',
                state === 'stale' && 'bg-amber-500 animate-pulse',
                state === 'fresh' && 'bg-green-500',
                className
              )}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
            {lastUpdated && <p className="text-xs text-muted-foreground">Updated {lastUpdated}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Icon variant - just an icon with tooltip
  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onRefresh}
              disabled={isFetching}
              className={cn(
                'p-1 rounded-md hover:bg-slate-100 transition-colors',
                onRefresh && 'cursor-pointer',
                !onRefresh && 'cursor-default',
                className
              )}
            >
              <Icon
                className={cn(
                  iconSize,
                  config.color,
                  isFetching && 'animate-spin'
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.label}</p>
            {lastUpdated && <p className="text-xs text-muted-foreground">Updated {lastUpdated}</p>}
            {onRefresh && <p className="text-xs text-muted-foreground">Click to refresh</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Text variant - icon + text inline
  if (variant === 'text') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5',
          textSize,
          config.color,
          className
        )}
      >
        <Icon className={cn(iconSize, isFetching && 'animate-spin')} />
        <span>{isFetching ? 'Refreshing...' : lastUpdated ? `Updated ${lastUpdated}` : config.label}</span>
        {onRefresh && !isFetching && (
          <button
            onClick={onRefresh}
            className="ml-1 hover:underline"
          >
            Refresh
          </button>
        )}
      </div>
    );
  }

  // Badge variant (default)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full border',
              textSize,
              config.bgColor,
              config.borderColor,
              config.color,
              onRefresh && 'cursor-pointer hover:opacity-80',
              !onRefresh && 'cursor-default',
              className
            )}
          >
            <Icon className={cn(iconSize, isFetching && 'animate-spin')} />
            <span>{config.label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {lastUpdated && <p>Updated {lastUpdated}</p>}
          {onRefresh && <p className="text-xs text-muted-foreground">Click to refresh</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

/**
 * Hook to get freshness props from a React Query result
 */
export function useFreshnessProps(query: {
  dataUpdatedAt?: number;
  isFetching?: boolean;
  isStale?: boolean;
  isError?: boolean;
  refetch?: () => void;
}) {
  return {
    dataUpdatedAt: query.dataUpdatedAt,
    isFetching: query.isFetching,
    isStale: query.isStale,
    isError: query.isError,
    onRefresh: query.refetch,
  };
}

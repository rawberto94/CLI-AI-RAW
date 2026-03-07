/**
 * Sync Status Indicator
 * 
 * Shows real-time sync status in the UI header/shell.
 * Indicates online/offline state, pending changes, and sync activity.
 */

'use client';

import { memo } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clock, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBackgroundSync, getSyncStatusDisplay } from '@/hooks/use-background-sync';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface SyncStatusIndicatorProps {
  className?: string;
  /** Show detailed popover on click */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export const SyncStatusIndicator = memo(function SyncStatusIndicator({
  className,
  showDetails = true,
  compact = false,
}: SyncStatusIndicatorProps) {
  const { status, syncNow, clearPending } = useBackgroundSync();
  const display = getSyncStatusDisplay(status);

  const iconMap = {
    'wifi-off': WifiOff,
    'refresh': RefreshCw,
    'clock': Clock,
    'check': CheckCircle2,
  };

  const colorMap = {
    red: 'text-red-500 bg-red-100',
    yellow: 'text-yellow-600 bg-yellow-100',
    orange: 'text-orange-500 bg-orange-100',
    green: 'text-green-600 bg-green-100',
  };

  const Icon = iconMap[display.icon as keyof typeof iconMap] || CheckCircle2;
  const colors = colorMap[display.color];

  // Compact mode - just an icon
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full',
                colors,
                status.isSyncing && 'animate-pulse',
                className
              )}
            >
              <Icon 
                className={cn(
                  'w-4 h-4',
                  status.isSyncing && 'animate-spin'
                )} 
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{display.label}</p>
            {status.pendingCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {status.pendingCount} changes pending
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full mode with popover
  if (showDetails) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-2 h-8',
              !status.isOnline && 'text-red-600',
              className
            )}
          >
            <Icon 
              className={cn(
                'w-4 h-4',
                status.isSyncing && 'animate-spin'
              )} 
            />
            <span className="text-xs hidden sm:inline">{display.label}</span>
            {status.pendingCount > 0 && !status.isSyncing && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {status.pendingCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {status.isOnline ? (
                <Wifi className="w-4 h-4 text-green-600" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">
                {status.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>

            {status.pendingCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{status.pendingCount} changes pending</span>
              </div>
            )}

            {status.lastSyncAt && (
              <div className="text-xs text-muted-foreground">
                Last synced: {status.lastSyncAt.toLocaleTimeString()}
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncNow()}
                disabled={!status.isOnline || status.isSyncing || status.pendingCount === 0}
                className="flex-1"
              >
                <RefreshCw className={cn('w-3 h-3 mr-1', status.isSyncing && 'animate-spin')} />
                Sync Now
              </Button>
              {status.pendingCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => clearPending()}
                  className="text-red-600 hover:text-red-700"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Simple badge mode
  return (
    <Badge
      variant={status.isOnline ? 'secondary' : 'destructive'}
      className={cn('gap-1', className)}
    >
      <Icon 
        className={cn(
          'w-3 h-3',
          status.isSyncing && 'animate-spin'
        )} 
      />
      <span className="text-xs">{display.label}</span>
    </Badge>
  );
});

/**
 * Minimal connection indicator - just a dot
 */
export const ConnectionDot = memo(function ConnectionDot({ className }: { className?: string }) {
  const { status } = useBackgroundSync();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-block w-2 h-2 rounded-full',
              status.isOnline ? 'bg-green-500' : 'bg-red-500',
              status.isSyncing && 'animate-pulse',
              className
            )}
          />
        </TooltipTrigger>
        <TooltipContent>
          {status.isOnline ? 'Connected' : 'Offline'}
          {status.pendingCount > 0 && ` (${status.pendingCount} pending)`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

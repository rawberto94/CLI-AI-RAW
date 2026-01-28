'use client';

/**
 * Status Indicators
 * Visual indicators for connection status, sync status, and system health
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wifi, 
  WifiOff, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Activity,
  Server,
  Database,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Connection Status Indicator
interface ConnectionStatusProps {
  status: 'online' | 'offline' | 'reconnecting';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConnectionStatus({ status, showLabel = true, size = 'md' }: ConnectionStatusProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  const statusConfig = {
    online: {
      icon: Wifi,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500',
      label: 'Connected',
    },
    offline: {
      icon: WifiOff,
      color: 'text-red-500',
      bgColor: 'bg-red-500',
      label: 'Offline',
    },
    reconnecting: {
      icon: RefreshCw,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500',
      label: 'Reconnecting...',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Icon className={cn(sizeClasses[size], config.color, status === 'reconnecting' && 'animate-spin')} />
        {status === 'online' && (
          <span className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full", config.bgColor)}>
            <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-75" />
          </span>
        )}
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

// Sync Status Indicator
interface SyncStatusProps {
  status: 'synced' | 'syncing' | 'error' | 'pending';
  lastSynced?: Date;
  showLabel?: boolean;
}

export function SyncStatus({ status, lastSynced, showLabel = true }: SyncStatusProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastSynced) return;

    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastSynced.getTime()) / 1000);
      if (seconds < 60) {
        setTimeAgo('just now');
      } else if (seconds < 3600) {
        setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      } else if (seconds < 86400) {
        setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
      } else {
        setTimeAgo(`${Math.floor(seconds / 86400)}d ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const statusConfig = {
    synced: {
      icon: Cloud,
      color: 'text-violet-500',
      label: 'Synced',
    },
    syncing: {
      icon: RefreshCw,
      color: 'text-violet-500',
      label: 'Syncing...',
    },
    error: {
      icon: CloudOff,
      color: 'text-red-500',
      label: 'Sync Error',
    },
    pending: {
      icon: Cloud,
      color: 'text-amber-500',
      label: 'Pending',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4", config.color, status === 'syncing' && 'animate-spin')} />
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
          {lastSynced && status === 'synced' && (
            <span className="text-[10px] text-slate-400">{timeAgo}</span>
          )}
        </div>
      )}
    </div>
  );
}

// System Health Indicator
interface HealthMetric {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  icon: React.ElementType;
  latency?: number;
}

interface SystemHealthProps {
  metrics?: HealthMetric[];
  compact?: boolean;
}

export function SystemHealth({ metrics: propMetrics, compact = true }: SystemHealthProps) {
  const [metrics, setMetrics] = useState<HealthMetric[]>(propMetrics || [
    { name: 'API', status: 'healthy', icon: Server },
    { name: 'Database', status: 'healthy', icon: Database },
    { name: 'AI Service', status: 'healthy', icon: Zap },
  ]);
  const [expanded, setExpanded] = useState(false);

  const overallStatus = metrics.every(m => m.status === 'healthy') 
    ? 'healthy' 
    : metrics.some(m => m.status === 'down') 
    ? 'down' 
    : 'degraded';

  const statusColors = {
    healthy: 'text-violet-500 bg-violet-500',
    degraded: 'text-amber-500 bg-amber-500',
    down: 'text-red-500 bg-red-500',
  };

  if (compact) {
    return (
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <Activity className={cn("h-4 w-4", statusColors[overallStatus].split(' ')[0])} />
        <span className={cn(
          "h-2 w-2 rounded-full",
          statusColors[overallStatus].split(' ')[1]
        )} />
        
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-50"
            >
              <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
                System Status
              </h4>
              <div className="space-y-2">
                {metrics.map((metric) => (
                  <div key={metric.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <metric.icon className="h-3 w-3 text-slate-400" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {metric.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {metric.latency && (
                        <span className="text-[10px] text-slate-400">
                          {metric.latency}ms
                        </span>
                      )}
                      <span className={cn(
                        "h-2 w-2 rounded-full",
                        statusColors[metric.status].split(' ')[1]
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          System Health
        </h3>
        <div className="flex items-center gap-2">
          <span className={cn(
            "h-2 w-2 rounded-full",
            statusColors[overallStatus].split(' ')[1]
          )} />
          <span className={cn("text-xs font-medium", statusColors[overallStatus].split(' ')[0])}>
            {overallStatus === 'healthy' ? 'All Systems Operational' : 
             overallStatus === 'degraded' ? 'Degraded Performance' : 'System Issues'}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                metric.status === 'healthy' ? 'bg-violet-100 dark:bg-violet-900/30' :
                metric.status === 'degraded' ? 'bg-amber-100 dark:bg-amber-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              )}>
                <metric.icon className={cn("h-4 w-4", statusColors[metric.status].split(' ')[0])} />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {metric.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {metric.latency && (
                <span className="text-xs text-slate-500">{metric.latency}ms</span>
              )}
              {metric.status === 'healthy' ? (
                <Check className="h-4 w-4 text-violet-500" />
              ) : metric.status === 'degraded' ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Auto-save Indicator
interface AutoSaveIndicatorProps {
  status: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved?: Date;
}

export function AutoSaveIndicator({ status, lastSaved }: AutoSaveIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (status === 'saved') {
      setShowSaved(true);
      const timer = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const statusConfig = {
    saved: { color: 'text-violet-500', label: 'Saved' },
    saving: { color: 'text-violet-500', label: 'Saving...' },
    unsaved: { color: 'text-amber-500', label: 'Unsaved changes' },
    error: { color: 'text-red-500', label: 'Save failed' },
  };

  const config = statusConfig[status];

  return (
    <AnimatePresence>
      {(status !== 'saved' || showSaved) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-center gap-2"
        >
          {status === 'saving' && (
            <RefreshCw className="h-3 w-3 text-violet-500 animate-spin" />
          )}
          {status === 'saved' && (
            <Check className="h-3 w-3 text-violet-500" />
          )}
          {(status === 'unsaved' || status === 'error') && (
            <span className={cn("h-2 w-2 rounded-full", status === 'unsaved' ? 'bg-amber-500' : 'bg-red-500')} />
          )}
          <span className={cn("text-xs", config.color)}>
            {config.label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Processing Status Banner
interface ProcessingStatusProps {
  isProcessing: boolean;
  message?: string;
  progress?: number;
  onCancel?: () => void;
}

export function ProcessingStatus({ isProcessing, message, progress, onCancel }: ProcessingStatusProps) {
  return (
    <AnimatePresence>
      {isProcessing && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-purple-50 dark:bg-purple-900/20 border-b border-indigo-100 dark:border-indigo-800 px-4 py-2">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-4 w-4 text-purple-600 dark:text-indigo-400 animate-spin" />
                <span className="text-sm text-purple-700 dark:text-indigo-300">
                  {message || 'Processing...'}
                </span>
                {progress !== undefined && (
                  <span className="text-xs text-purple-500">{progress}%</span>
                )}
              </div>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="text-xs text-purple-600 dark:text-indigo-400 hover:text-purple-700 dark:hover:text-indigo-300 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
            {progress !== undefined && (
              <div className="mt-2 h-1 bg-purple-100 dark:bg-purple-800 rounded-full max-w-7xl mx-auto overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-purple-500 rounded-full"
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ConnectionStatus;

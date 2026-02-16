/**
 * Sync Status Component
 * 
 * Real-time sync status display with progress tracking.
 * Uses polling for status updates (can be enhanced with WebSocket).
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  RefreshCw,
  Clock,
  FileText,
  FolderSync,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

interface SyncProgress {
  sourceId: string;
  syncId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  syncMode: string;
  filesFound: number;
  filesProcessed: number;
  filesSkipped: number;
  filesFailed: number;
  currentFile?: string;
  startedAt: string;
  estimatedCompletion?: string;
  errorMessage?: string;
}

interface SyncStatusProps {
  sourceId: string;
  sourceName?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onSyncComplete?: () => void;
  compact?: boolean;
}

export function SyncStatus({
  sourceId,
  sourceName,
  autoRefresh = true,
  refreshInterval = 2000,
  onSyncComplete,
  compact = false,
}: SyncStatusProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  // Fetch sync progress
  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/contract-sources/sync?sourceId=${sourceId}&action=progress`
      );
      const data = await res.json();

      if (data.success && data.data.progress) {
        const newProgress = data.data.progress;
        setProgress(newProgress);

        // Check if sync just completed
        if (
          newProgress.status === "COMPLETED" ||
          newProgress.status === "FAILED" ||
          newProgress.status === "CANCELLED"
        ) {
          onSyncComplete?.();
        }
      } else {
        setProgress(null);
      }
      setError(null);
    } catch (err) {
      setError("Failed to fetch sync status");
    } finally {
      setIsLoading(false);
    }
  }, [sourceId, onSyncComplete]);

  // Initial fetch and polling
  useEffect(() => {
    fetchProgress();

    if (autoRefresh) {
      const interval = setInterval(() => {
        // Only poll if there's an active sync
        if (progress?.status === "IN_PROGRESS") {
          fetchProgress();
        }
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [fetchProgress, autoRefresh, refreshInterval, progress?.status]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!progress) {
    return compact ? null : (
      <div className="text-sm text-slate-500 py-2">
        No active sync in progress
      </div>
    );
  }

  const percentComplete = progress.filesFound > 0
    ? Math.round((progress.filesProcessed / progress.filesFound) * 100)
    : 0;

  const statusConfig = {
    IN_PROGRESS: {
      icon: Loader2,
      color: "text-violet-600",
      bgColor: "bg-violet-100 dark:bg-violet-900",
      label: "Syncing",
      animate: true,
    },
    COMPLETED: {
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900",
      label: "Completed",
      animate: false,
    },
    FAILED: {
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-900",
      label: "Failed",
      animate: false,
    },
    CANCELLED: {
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100 dark:bg-yellow-900",
      label: "Cancelled",
      animate: false,
    },
  };

  const config = statusConfig[progress.status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
          config.bgColor
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <StatusIcon
          className={cn(
            "w-4 h-4",
            config.color,
            config.animate && "animate-spin"
          )}
        />
        <span className="text-sm font-medium">{config.label}</span>
        {progress.status === "IN_PROGRESS" && (
          <span className="text-sm text-slate-500">{percentComplete}%</span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 ml-auto" />
        )}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className={cn("py-4", config.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-white/50 dark:bg-black/20")}>
              <StatusIcon
                className={cn(
                  "w-5 h-5",
                  config.color,
                  config.animate && "animate-spin"
                )}
              />
            </div>
            <div>
              <CardTitle className="text-base">
                {sourceName || "Contract Sync"}
              </CardTitle>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {config.label} • {progress.syncMode}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="font-mono">
            {progress.syncId.slice(0, 8)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Progress Bar */}
        {progress.status === "IN_PROGRESS" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Progress</span>
              <span className="font-medium">{percentComplete}%</span>
            </div>
            <Progress value={percentComplete} className="h-2" />
            {progress.currentFile && (
              <p className="text-xs text-slate-500 truncate">
                Processing: {progress.currentFile}
              </p>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-2xl font-bold">{progress.filesFound}</p>
            <p className="text-xs text-slate-500">Found</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {progress.filesProcessed}
            </p>
            <p className="text-xs text-slate-500">Processed</p>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="text-2xl font-bold">{progress.filesSkipped}</p>
            <p className="text-xs text-slate-500">Skipped</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {progress.filesFailed}
            </p>
            <p className="text-xs text-slate-500">Failed</p>
          </div>
        </div>

        {/* Timing Info */}
        <div className="flex items-center justify-between text-sm text-slate-500 pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Started {formatDistanceToNow(new Date(progress.startedAt), { addSuffix: true })}
          </div>
          {progress.estimatedCompletion && progress.status === "IN_PROGRESS" && (
            <div>
              Est. completion:{" "}
              {format(new Date(progress.estimatedCompletion), "HH:mm")}
            </div>
          )}
        </div>

        {/* Error Message */}
        {progress.status === "FAILED" && progress.errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              {progress.errorMessage}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mini sync indicator for table rows
 */
export function SyncIndicator({ status }: { status: string }) {
  const configs: Record<string, { icon: typeof Loader2; color: string; animate?: boolean }> = {
    SYNCING: { icon: Loader2, color: "text-violet-500", animate: true },
    CONNECTED: { icon: CheckCircle2, color: "text-green-500" },
    ERROR: { icon: XCircle, color: "text-red-500" },
    DISCONNECTED: { icon: AlertCircle, color: "text-gray-400" },
    AUTH_EXPIRED: { icon: Clock, color: "text-yellow-500" },
  };

  const config = configs[status] || configs.DISCONNECTED;
  const Icon = config.icon;

  return (
    <Icon
      className={cn(
        "w-4 h-4",
        config.color,
        config.animate && "animate-spin"
      )}
    />
  );
}

/**
 * Sync Activity Feed Component
 */
export function SyncActivityFeed({ sourceId }: { sourceId: string }) {
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(
          `/api/contract-sources/sync?sourceId=${sourceId}&limit=5`
        );
        const data = await res.json();
        if (data.success) {
          setActivities(data.data.syncs || []);
        }
      } catch (error) {
        console.error("Failed to fetch activity:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActivity();
  }, [sourceId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-slate-500 text-sm">
        No sync activity yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <SyncIndicator
              status={
                activity.status === "COMPLETED"
                  ? "CONNECTED"
                  : activity.status === "FAILED"
                  ? "ERROR"
                  : "SYNCING"
              }
            />
            <div>
              <p className="text-sm font-medium">
                {activity.filesProcessed} files synced
              </p>
              <p className="text-xs text-slate-500">
                {formatDistanceToNow(new Date(activity.startedAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
          <Badge
            variant={
              activity.status === "COMPLETED"
                ? "default"
                : activity.status === "FAILED"
                ? "destructive"
                : "secondary"
            }
          >
            {activity.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export default SyncStatus;

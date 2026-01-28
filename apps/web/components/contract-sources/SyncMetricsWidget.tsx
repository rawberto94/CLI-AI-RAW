/**
 * Contract Sync Metrics Dashboard Widget
 * 
 * Displays sync statistics and health metrics for all contract sources.
 * Can be embedded in dashboards or used standalone.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  FileText,
  FolderSync,
  RefreshCw,
  ArrowUpRight,
  BarChart3,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, subDays, format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface SyncMetrics {
  totalSources: number;
  connectedSources: number;
  errorSources: number;
  totalFilesSynced: number;
  filesLast24h: number;
  filesLast7d: number;
  avgSyncDuration: number;
  successRate: number;
  recentSyncs: RecentSync[];
  sourceHealth: SourceHealth[];
}

interface RecentSync {
  id: string;
  sourceName: string;
  provider: string;
  status: string;
  filesProcessed: number;
  duration: number;
  completedAt: string;
}

interface SourceHealth {
  id: string;
  name: string;
  provider: string;
  status: string;
  lastSyncAt?: string;
  errorCount: number;
  successRate: number;
}

interface SyncMetricsWidgetProps {
  refreshInterval?: number;
  compact?: boolean;
  showRecentSyncs?: boolean;
  showSourceHealth?: boolean;
  maxRecentSyncs?: number;
  className?: string;
}

export function SyncMetricsWidget({
  refreshInterval = 30000,
  compact = false,
  showRecentSyncs = true,
  showSourceHealth = true,
  maxRecentSyncs = 5,
  className,
}: SyncMetricsWidgetProps) {
  const [metrics, setMetrics] = useState<SyncMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/contract-sources/metrics");
      const data = await res.json();

      if (data.success) {
        setMetrics(data.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(data.error || "Failed to fetch metrics");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </CardContent>
      </Card>
    );
  }

  if (error || !metrics) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
          <p className="text-slate-600">{error || "No data available"}</p>
          <Button variant="outline" size="sm" onClick={fetchMetrics} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
                <FolderSync className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Contract Sources</p>
                <p className="text-xl font-bold">
                  {metrics.connectedSources}/{metrics.totalSources} Active
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Last 24h</p>
              <p className="text-xl font-bold text-green-600">
                +{metrics.filesLast24h} files
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-500">Success rate</span>
            <span className="font-medium">{metrics.successRate.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.successRate} className="mt-2 h-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Sync Overview</h2>
          <p className="text-sm text-slate-500">
            {lastUpdated && `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Link href="/settings/contract-sources">
            <Button size="sm">
              Manage Sources
              <ArrowUpRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
                <FolderSync className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Sources</p>
                <p className="text-2xl font-bold">{metrics.totalSources}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Badge variant={metrics.errorSources > 0 ? "destructive" : "default"}>
                {metrics.connectedSources} connected
              </Badge>
              {metrics.errorSources > 0 && (
                <Badge variant="destructive">{metrics.errorSources} errors</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Files Synced</p>
                <p className="text-2xl font-bold">{metrics.totalFilesSynced.toLocaleString()}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-sm text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span>+{metrics.filesLast24h} today</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Activity className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Success Rate</p>
                <p className="text-2xl font-bold">{metrics.successRate.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={metrics.successRate} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {(metrics.avgSyncDuration / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-500">per sync operation</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Syncs */}
      {showRecentSyncs && metrics.recentSyncs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Syncs</CardTitle>
            <CardDescription>Latest sync operations across all sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentSyncs.slice(0, maxRecentSyncs).map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {sync.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : sync.status === "FAILED" ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                    )}
                    <div>
                      <p className="font-medium">{sync.sourceName}</p>
                      <p className="text-sm text-slate-500">
                        {sync.filesProcessed} files •{" "}
                        {(sync.duration / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{sync.provider}</Badge>
                    <p className="text-xs text-slate-500 mt-1">
                      {formatDistanceToNow(new Date(sync.completedAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Health */}
      {showSourceHealth && metrics.sourceHealth.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Health</CardTitle>
            <CardDescription>Connection status and reliability by source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.sourceHealth.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        source.status === "CONNECTED"
                          ? "bg-green-500"
                          : source.status === "ERROR"
                          ? "bg-red-500"
                          : "bg-gray-400"
                      )}
                    />
                    <div>
                      <p className="font-medium">{source.name}</p>
                      <p className="text-sm text-slate-500">
                        {source.lastSyncAt
                          ? `Last sync ${formatDistanceToNow(new Date(source.lastSyncAt), {
                              addSuffix: true,
                            })}`
                          : "Never synced"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {source.successRate.toFixed(0)}% success
                      </p>
                      {source.errorCount > 0 && (
                        <p className="text-xs text-red-500">
                          {source.errorCount} errors
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        source.status === "CONNECTED"
                          ? "default"
                          : source.status === "ERROR"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {source.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SyncMetricsWidget;

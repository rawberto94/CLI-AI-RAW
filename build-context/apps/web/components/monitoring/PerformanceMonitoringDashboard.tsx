'use client';

/**
 * Performance Monitoring Dashboard
 * Displays real-time performance metrics including page load, API calls, and render performance
 */

import { useState, useEffect } from 'react';
import { usePerformanceMetrics } from '@/hooks/usePerformanceMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';

export function PerformanceMonitoringDashboard() {
  const { getPageLoadMetrics, getApiMetrics, getRenderMetrics, getSummary } = usePerformanceMetrics();
  const [summary, setSummary] = useState<ReturnType<typeof getSummary> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const updateMetrics = () => {
      setSummary(getSummary());
    };

    updateMetrics();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      updateMetrics();
      setRefreshKey(prev => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [getSummary]);

  if (!summary) {
    return null;
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceRating = (value: number, threshold: number): 'good' | 'warning' | 'poor' => {
    if (value <= threshold) return 'good';
    if (value <= threshold * 1.5) return 'warning';
    return 'poor';
  };

  const getRatingColor = (rating: 'good' | 'warning' | 'poor') => {
    switch (rating) {
      case 'good':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'poor':
        return 'bg-red-500';
    }
  };

  const getRatingBadge = (rating: 'good' | 'warning' | 'poor') => {
    switch (rating) {
      case 'good':
        return <Badge className="bg-green-500">Good</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Needs Improvement</Badge>;
      case 'poor':
        return <Badge className="bg-red-500">Poor</Badge>;
    }
  };

  const pageLoadRating = getPerformanceRating(summary.pageLoad.avgLoadTime, 2000);
  const apiRating = getPerformanceRating(summary.api.avgResponseTime, 200);
  const renderRating = getPerformanceRating(summary.render.avgRenderTime, 16);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Performance Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            Real-time performance metrics and Core Web Vitals
          </p>
        </div>
        <Badge variant="outline">
          Auto-refresh: 5s
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Page Load Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Load Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(summary.pageLoad.avgLoadTime)}
            </div>
            <div className="flex items-center justify-between mt-2">
              {getRatingBadge(pageLoadRating)}
              <p className="text-xs text-muted-foreground">
                Target: &lt; 2s
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">FCP:</span>
                <span>{formatTime(summary.pageLoad.avgFCP)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Samples:</span>
                <span>{summary.pageLoad.count}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Response Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(summary.api.avgResponseTime)}
            </div>
            <div className="flex items-center justify-between mt-2">
              {getRatingBadge(apiRating)}
              <p className="text-xs text-muted-foreground">
                Target: &lt; 200ms
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Slow calls:</span>
                <span className={summary.api.slowCallsCount > 0 ? 'text-red-500' : ''}>
                  {summary.api.slowCallsCount}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total calls:</span>
                <span>{summary.api.totalCalls}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Render Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Render Performance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTime(summary.render.avgRenderTime)}
            </div>
            <div className="flex items-center justify-between mt-2">
              {getRatingBadge(renderRating)}
              <p className="text-xs text-muted-foreground">
                Target: &lt; 16ms
              </p>
            </div>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Slow renders:</span>
                <span className={summary.render.slowRendersCount > 0 ? 'text-yellow-500' : ''}>
                  {summary.render.slowRendersCount}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total renders:</span>
                <span>{summary.render.totalRenders}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Targets */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Targets</CardTitle>
          <CardDescription>
            Based on production readiness requirements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Page Load Time</p>
                <p className="text-xs text-muted-foreground">
                  Initial page load on standard connections
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getRatingColor(pageLoadRating)}`} />
                <span className="text-sm font-medium">
                  {formatTime(summary.pageLoad.avgLoadTime)} / 2s
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">API Response Time</p>
                <p className="text-xs text-muted-foreground">
                  User interaction response time
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getRatingColor(apiRating)}`} />
                <span className="text-sm font-medium">
                  {formatTime(summary.api.avgResponseTime)} / 200ms
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Render Performance</p>
                <p className="text-xs text-muted-foreground">
                  Component render time (60 FPS = 16ms)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getRatingColor(renderRating)}`} />
                <span className="text-sm font-medium">
                  {formatTime(summary.render.avgRenderTime)} / 16ms
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent API Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent API Calls</CardTitle>
          <CardDescription>
            Last {Math.min(summary.api.totalCalls, 10)} API requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {getApiMetrics().slice(-10).reverse().map((metric, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {metric.method}
                  </Badge>
                  <span className="text-xs font-mono truncate max-w-[300px]">
                    {metric.endpoint}
                  </span>
                  {metric.cached && (
                    <Badge variant="secondary" className="text-xs">
                      Cached
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={metric.duration > 2000 ? 'text-red-500 font-medium' : ''}>
                    {formatTime(metric.duration)}
                  </span>
                  <Badge
                    variant={metric.status >= 200 && metric.status < 300 ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {metric.status}
                  </Badge>
                </div>
              </div>
            ))}
            {summary.api.totalCalls === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No API calls recorded yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

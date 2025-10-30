'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, Zap, AlertTriangle } from 'lucide-react';

interface PerformanceMetrics {
  timestamp: string;
  health: {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  };
  cache: {
    l1Hits: number;
    l2Hits: number;
    misses: number;
    hitRate: string;
    l1Size: number;
    l2Connected: boolean;
  };
  database: {
    activeConnections: number;
    idleConnections: number;
    totalConnections: number;
    utilizationRate: number;
    slowQueryRate: number;
    errorRate: number;
  };
  system: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      rss: number;
    };
  };
}

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/rate-cards/performance-metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return <div>Loading performance metrics...</div>;
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
          <CardDescription>Overall system performance and health status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">{metrics.health.score.toFixed(0)}</div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(metrics.health.status)}`}>
              {metrics.health.status.toUpperCase()}
            </div>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>

      {/* Cache Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Cache Performance
          </CardTitle>
          <CardDescription>Multi-level cache statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Hit Rate</div>
              <div className="text-2xl font-bold">{metrics.cache.hitRate}</div>
              <div className="text-xs text-muted-foreground mt-1">Target: &gt;95%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">L1 Hits</div>
              <div className="text-2xl font-bold">{metrics.cache.l1Hits.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">L2 Hits</div>
              <div className="text-2xl font-bold">{metrics.cache.l2Hits.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Misses</div>
              <div className="text-2xl font-bold">{metrics.cache.misses.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${metrics.cache.l2Connected ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-sm text-muted-foreground">
              Redis: {metrics.cache.l2Connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Database Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Performance
          </CardTitle>
          <CardDescription>Connection pool and query statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Active Connections</div>
              <div className="text-2xl font-bold">{metrics.database.activeConnections}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Idle Connections</div>
              <div className="text-2xl font-bold">{metrics.database.idleConnections}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Utilization</div>
              <div className="text-2xl font-bold">{(metrics.database.utilizationRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Target: &lt;80%</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Slow Queries</div>
              <div className="text-2xl font-bold">{(metrics.database.slowQueryRate * 100).toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">Target: &lt;10%</div>
            </div>
          </div>

          {/* Warnings */}
          {(metrics.database.utilizationRate > 0.8 || metrics.database.slowQueryRate > 0.1) && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                {metrics.database.utilizationRate > 0.8 && <div>High connection pool utilization detected</div>}
                {metrics.database.slowQueryRate > 0.1 && <div>High slow query rate detected</div>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Resources */}
      <Card>
        <CardHeader>
          <CardTitle>System Resources</CardTitle>
          <CardDescription>Memory usage and uptime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Uptime</div>
              <div className="text-2xl font-bold">{formatUptime(metrics.system.uptime)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Heap Used</div>
              <div className="text-2xl font-bold">{metrics.system.memory.used.toFixed(0)} MB</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">RSS</div>
              <div className="text-2xl font-bold">{metrics.system.memory.rss.toFixed(0)} MB</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

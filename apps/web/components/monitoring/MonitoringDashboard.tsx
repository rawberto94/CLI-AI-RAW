'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SystemMetrics {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  traces: {
    active: number;
    total: number;
  };
  logs: {
    total: number;
    errors: number;
    warnings: number;
  };
}

interface PerformanceMetrics {
  apiResponseTimes: Record<string, {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    count: number;
  }>;
  errorRate: string;
}

interface RealTimeMetrics {
  sseConnections: number;
  eventsEmitted: number;
  eventsProcessed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRatio: string;
}

interface MonitoringData {
  timestamp: string;
  system: SystemMetrics;
  performance: PerformanceMetrics;
  realTime: RealTimeMetrics;
  cache: CacheMetrics;
}

interface LogEntry {
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  context?: any;
}

interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  threshold: {
    metric: string;
    value: number;
  };
  currentValue: number;
}

export function MonitoringDashboard({ refreshInterval = 5000 }: { refreshInterval?: number }) {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/monitoring/metrics');
        if (!response.ok) throw new Error('Failed to fetch metrics');
        
        const metricsData = await response.json();
        setData(metricsData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const fetchLogs = async () => {
      try {
        const response = await fetch('/api/monitoring/logs?limit=50');
        if (!response.ok) throw new Error('Failed to fetch logs');
        
        const logsData = await response.json();
        setLogs(logsData.logs);
      } catch (err) {
        console.error('Failed to fetch logs:', err);
      }
    };

    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/monitoring/alerts');
        if (!response.ok) throw new Error('Failed to fetch alerts');
        
        const alertsData = await response.json();
        setAlerts(alertsData.active);
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
      }
    };

    fetchMetrics();
    fetchLogs();
    fetchAlerts();

    const interval = setInterval(() => {
      fetchMetrics();
      fetchLogs();
      fetchAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading monitoring data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const getHealthStatus = () => {
    const errorRate = parseFloat(data.performance.errorRate);
    if (errorRate > 1) return { status: 'unhealthy', color: 'destructive' };
    if (errorRate > 0.1) return { status: 'degraded', color: 'warning' };
    return { status: 'healthy', color: 'success' };
  };

  const health = getHealthStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Monitoring</h2>
          <p className="text-muted-foreground">
            Real-time system health and performance metrics
          </p>
        </div>
        <Badge 
          variant={health.status === 'healthy' ? 'secondary' : 'destructive'} 
          className="text-lg px-4 py-2"
        >
          {health.status.toUpperCase()}
        </Badge>
      </div>

      {/* Active Alerts Banner */}
      {alerts.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-5 w-5 text-destructive"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              Active Alerts ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'secondary'}
                  >
                    {alert.severity}
                  </Badge>
                  <div className="flex-1">
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length > 3 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  +{alerts.length - 3} more alerts
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SSE Connections</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.realTime.sseConnections}</div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Ratio</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.cache.hitRatio}%</div>
            <p className="text-xs text-muted-foreground">
              {data.cache.hits} hits / {data.cache.misses} misses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Processed</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.realTime.eventsProcessed}</div>
            <p className="text-xs text-muted-foreground">
              {data.realTime.eventsEmitted} emitted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.performance.errorRate}</div>
            <p className="text-xs text-muted-foreground">Errors per minute</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Current system alerts requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-4 p-4 border rounded-lg"
                  >
                    <Badge
                      variant={
                        alert.severity === 'critical' || alert.severity === 'high'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {alert.severity}
                    </Badge>
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-sm text-muted-foreground">
                        Metric: {alert.threshold.metric} | Current: {alert.currentValue.toFixed(2)} | Threshold: {alert.threshold.value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={async () => {
                          try {
                            await fetch(`/api/monitoring/alerts/${alert.id}/acknowledge`, {
                              method: 'POST',
                            });
                            // Refresh alerts
                            const response = await fetch('/api/monitoring/alerts');
                            const data = await response.json();
                            setAlerts(data.active);
                          } catch (err) {
                            console.error('Failed to acknowledge alert:', err);
                          }
                        }}
                        className="text-sm text-primary hover:underline"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No active alerts
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Response Times</CardTitle>
              <CardDescription>Average response times by endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.performance.apiResponseTimes).map(([endpoint, stats]) => (
                  <div key={endpoint} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{endpoint}</span>
                      <span className="text-sm text-muted-foreground">{stats.count} requests</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Avg</div>
                        <div className="font-medium">{stats.avg}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P50</div>
                        <div className="font-medium">{stats.p50}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P95</div>
                        <div className="font-medium">{stats.p95}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P99</div>
                        <div className="font-medium">{stats.p99}ms</div>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(data.performance.apiResponseTimes).length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No API metrics available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Logs</CardTitle>
              <CardDescription>Last 50 log entries</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm border-b pb-2 last:border-0"
                  >
                    <Badge
                      variant={
                        log.level === 'error'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="mt-0.5"
                    >
                      {log.level}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{log.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                        {log.requestId && ` • Request: ${log.requestId.slice(0, 8)}`}
                      </div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No logs available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Active Traces</CardTitle>
                <CardDescription>Request tracing information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Active</span>
                    <span className="font-medium">{data.system.traces.active}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total</span>
                    <span className="font-medium">{data.system.traces.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Log Summary</CardTitle>
                <CardDescription>Log entries by level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total</span>
                    <span className="font-medium">{data.system.logs.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Errors</span>
                    <span className="font-medium text-destructive">{data.system.logs.errors}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Warnings</span>
                    <span className="font-medium text-yellow-600">{data.system.logs.warnings}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-center">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

// Auto-generated default export
export default MonitoringDashboard;

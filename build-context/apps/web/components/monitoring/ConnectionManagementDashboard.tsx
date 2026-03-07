/**
 * Connection Management Dashboard
 * Displays SSE connection metrics and management controls
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Wifi,
  WifiOff,
  Activity,
  Users,
  Clock,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByTenant: Record<string, number>;
  connectionsByState: Record<string, number>;
  averageConnectionDuration: number;
  totalReconnectAttempts: number;
  staleConnections: number;
}

interface StaleConnectionsData {
  stale: {
    count: number;
    connections: Array<{
      id: string;
      tenantId: string;
      userId?: string;
      state: string;
      lastActivity: string;
      inactiveDuration: number;
    }>;
  };
  timedOut: {
    count: number;
    connections: Array<{
      id: string;
      tenantId: string;
      userId?: string;
      state: string;
      createdAt: string;
      connectionDuration: number;
    }>;
  };
}

export function ConnectionManagementDashboard() {
  const [metrics, setMetrics] = useState<ConnectionMetrics | null>(null);
  const [staleData, setStaleData] = useState<StaleConnectionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/connections?action=metrics');
      const result = await response.json();
      if (result.success) {
        setMetrics(result.data);
      }
    } catch {
      // Failed to fetch metrics
    }
  };

  const fetchStaleConnections = async () => {
    try {
      const response = await fetch('/api/connections?action=stale');
      const result = await response.json();
      if (result.success) {
        setStaleData(result.data);
      }
    } catch {
      // Failed to fetch stale connections
    }
  };

  const performCleanup = async () => {
    setCleanupLoading(true);
    try {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' }),
      });
      const result = await response.json();
      if (result.success) {
        // Refresh data
        await Promise.all([fetchMetrics(), fetchStaleConnections()]);
      }
    } catch {
      // Cleanup failed silently
    } finally {
      setCleanupLoading(false);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMetrics(), fetchStaleConnections()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchMetrics();
      fetchStaleConnections();
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (loading && !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connection Management</CardTitle>
          <CardDescription>Loading connection data...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Connection Management</h2>
          <p className="text-muted-foreground">Monitor and manage SSE connections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
          </Button>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalConnections || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.activeConnections || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(metrics?.averageConnectionDuration || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Per connection</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconnect Attempts</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.totalReconnectAttempts || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total attempts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stale Connections</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.staleConnections || 0}</div>
            <p className="text-xs text-muted-foreground">Need cleanup</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">By Tenant</TabsTrigger>
          <TabsTrigger value="states">By State</TabsTrigger>
          <TabsTrigger value="stale">Stale Connections</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection States</CardTitle>
              <CardDescription>Distribution of connections by state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.connectionsByState &&
                  Object.entries(metrics.connectionsByState).map(([state, count]) => (
                    <div key={state} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{state}</Badge>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connections by Tenant</CardTitle>
              <CardDescription>Number of connections per tenant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metrics?.connectionsByTenant &&
                  Object.entries(metrics.connectionsByTenant).map(([tenant, count]) => (
                    <div key={tenant} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{tenant}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="states" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Connection States</CardTitle>
              <CardDescription>Detailed breakdown by connection state</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.connectionsByState &&
                  Object.entries(metrics.connectionsByState).map(([state, count]) => (
                    <div key={state} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{state}</span>
                        <Badge>{count}</Badge>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{
                            width: `${
                              ((count / (metrics?.totalConnections || 1)) * 100).toFixed(1)
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stale" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stale Connections</CardTitle>
                  <CardDescription>
                    Connections that need cleanup
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={performCleanup}
                  disabled={cleanupLoading || (!staleData?.stale.count && !staleData?.timedOut.count)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {cleanupLoading ? 'Cleaning...' : 'Cleanup All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Stale connections */}
                <div>
                  <h4 className="font-medium mb-2">
                    Inactive Connections ({staleData?.stale.count || 0})
                  </h4>
                  {staleData?.stale.connections.length ? (
                    <div className="space-y-2">
                      {staleData.stale.connections.slice(0, 5).map((conn) => (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium">{conn.id}</div>
                            <div className="text-xs text-muted-foreground">
                              Tenant: {conn.tenantId} | User: {conn.userId || 'anonymous'}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {formatDuration(conn.inactiveDuration)} inactive
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No inactive connections</p>
                  )}
                </div>

                {/* Timed out connections */}
                <div>
                  <h4 className="font-medium mb-2">
                    Timed Out Connections ({staleData?.timedOut.count || 0})
                  </h4>
                  {staleData?.timedOut.connections.length ? (
                    <div className="space-y-2">
                      {staleData.timedOut.connections.slice(0, 5).map((conn) => (
                        <div
                          key={conn.id}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium">{conn.id}</div>
                            <div className="text-xs text-muted-foreground">
                              Tenant: {conn.tenantId} | User: {conn.userId || 'anonymous'}
                            </div>
                          </div>
                          <Badge variant="outline">
                            {formatDuration(conn.connectionDuration)} duration
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No timed out connections</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Auto-generated default export
export default ConnectionManagementDashboard;

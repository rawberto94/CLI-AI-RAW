'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  FileText, 
  Server, 
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';

// Simple UI components for missing ones
const Alert: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div className={`p-4 border border-red-200 bg-red-50 rounded ${className}`}>
    {children}
  </div>
);

const AlertDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-red-800">{children}</div>
);

const Badge: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  variant?: 'default' | 'outline'
}> = ({ children, className = '', variant = 'default' }) => (
  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
    variant === 'outline' 
      ? 'border bg-white text-gray-700' 
      : 'bg-blue-100 text-blue-800'
  } ${className}`}>
    {children}
  </span>
);

const Progress: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
        style={{ width: value + '%' }}
      />
    </div>
  );
};

interface SystemMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  uploads: {
    total: number;
    successful: number;
    failed: number;
    averageFileSize: number;
  };
  analysis: {
    totalPipelines: number;
    activePipelines: number;
    completedPipelines: number;
    failedPipelines: number;
    averageProcessingTime: number;
  };
  errors: {
    byStatusCode: Record<number, number>;
    byEndpoint: Record<string, number>;
    recentErrors: Array<{
      timestamp: number;
      endpoint: string;
      error: string;
      requestId?: string;
    }>;
  };
  performance: {
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    uptime: number;
    cpuUsage?: {
      user: number;
      system: number;
    };
  };
  cache: {
    app: any;
    artifacts: any;
    contracts: any;
    analysis: any;
  };
  timestamp: number;
  uptime: number;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    errorRate: { status: 'pass' | 'fail'; value: number };
    recentErrors: { status: 'pass' | 'fail'; value: number };
    memoryUsage: { status: 'pass' | 'fail'; value: number };
    uptime: { status: 'pass'; value: number };
  };
  timestamp: number;
}

interface RecentRequest {
  timestamp: number;
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  tenantId?: string;
  requestId?: string;
  error?: string;
}

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/system');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    }
  };

  const fetchHealth = async () => {
    try {
      const response = await fetch('/api/metrics/health');
      if (!response.ok) throw new Error('Failed to fetch health status');
      const data = await response.json();
      setHealth(data);
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    }
  };

  const fetchRecentRequests = async () => {
    try {
      const response = await fetch('/api/metrics/requests');
      if (!response.ok) throw new Error('Failed to fetch recent requests');
      const data = await response.json();
      setRecentRequests(data.slice(0, 50)); // Show last 50 requests
    } catch (err) {
      console.error('Failed to fetch recent requests:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchHealth(), fetchRecentRequests()]);
      setLoading(false);
    };

    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'pass': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy': case 'fail': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="p-8">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">System Dashboard</h1>
          <p className="text-gray-600">Monitor system performance and health</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            onClick={() => setAutoRefresh(!autoRefresh)}
            size="sm"
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={() => Promise.all([fetchMetrics(), fetchHealth(), fetchRecentRequests()])} size="sm">
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-4">
              <Badge className={getStatusColor(health.status)}>
                {health.status.toUpperCase()}
              </Badge>
              <span className="text-sm text-gray-500">
                Last updated: {formatTimestamp(health.timestamp)}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(health.checks).map(([key, check]) => (
                <div key={key} className="text-center p-3 border rounded">
                  <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${getStatusColor(check.status)}`}>
                    {check.status === 'pass' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                    {check.status.toUpperCase()}
                  </div>
                  <p className="text-sm font-medium mt-1">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-xs text-gray-500">
                    {typeof check.value === 'number' ? check.value.toFixed(2) : check.value}
                    {key === 'memoryUsage' && ' MB'}
                    {key === 'errorRate' && '%'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.requests.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.requests.requestsPerMinute}/min current rate
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.requests.total > 0 
                  ? ((metrics.requests.success / metrics.requests.total) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.requests.errors} errors
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.requests.averageResponseTime.toFixed(0)}ms
              </div>
              <p className="text-xs text-muted-foreground">
                System performance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatBytes(metrics.performance.memoryUsage.heapUsed)}
              </div>
              <Progress 
                value={(metrics.performance.memoryUsage.heapUsed / metrics.performance.memoryUsage.heapTotal) * 100} 
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Metrics */}
      {metrics && (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="cache">Cache</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span>{formatDuration(metrics.performance.uptime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>RSS Memory:</span>
                    <span>{formatBytes(metrics.performance.memoryUsage.rss)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Used:</span>
                    <span>{formatBytes(metrics.performance.memoryUsage.heapUsed)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Heap Total:</span>
                    <span>{formatBytes(metrics.performance.memoryUsage.heapTotal)}</span>
                  </div>
                  {metrics.performance.cpuUsage && (
                    <>
                      <div className="flex justify-between">
                        <span>CPU User:</span>
                        <span>{(metrics.performance.cpuUsage.user / 1000).toFixed(2)}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPU System:</span>
                        <span>{(metrics.performance.cpuUsage.system / 1000).toFixed(2)}ms</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Total Uploads:</span>
                    <span>{metrics.uploads.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Upload Success Rate:</span>
                    <span>
                      {metrics.uploads.total > 0 
                        ? ((metrics.uploads.successful / metrics.uploads.total) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Pipelines:</span>
                    <span>{metrics.analysis.activePipelines}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Pipelines:</span>
                    <span>{metrics.analysis.completedPipelines}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Average Processing:</span>
                    <span>{(metrics.analysis.averageProcessingTime / 1000).toFixed(1)}s</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Requests</CardTitle>
                <CardDescription>Last 50 API requests</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Time</th>
                        <th className="text-left p-2">Method</th>
                        <th className="text-left p-2">URL</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Response Time</th>
                        <th className="text-left p-2">Tenant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRequests.map((req, i) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="p-2">{formatTimestamp(req.timestamp)}</td>
                          <td className="p-2">
                            <Badge variant="outline">{req.method}</Badge>
                          </td>
                          <td className="p-2 max-w-xs truncate">{req.url}</td>
                          <td className="p-2">
                            <Badge 
                              className={req.statusCode >= 400 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                            >
                              {req.statusCode}
                            </Badge>
                          </td>
                          <td className="p-2">{req.responseTime}ms</td>
                          <td className="p-2">{req.tenantId || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uploads" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Upload Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-blue-600">{metrics.uploads.total}</div>
                    <div className="text-sm text-gray-500">Total</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-green-600">{metrics.uploads.successful}</div>
                    <div className="text-sm text-gray-500">Successful</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-red-600">{metrics.uploads.failed}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-purple-600">{formatBytes(metrics.uploads.averageFileSize)}</div>
                    <div className="text-sm text-gray-500">Avg Size</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Pipeline Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-blue-600">{metrics.analysis.totalPipelines}</div>
                    <div className="text-sm text-gray-500">Total</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-yellow-600">{metrics.analysis.activePipelines}</div>
                    <div className="text-sm text-gray-500">Active</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-green-600">{metrics.analysis.completedPipelines}</div>
                    <div className="text-sm text-gray-500">Completed</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-red-600">{metrics.analysis.failedPipelines}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                  <div className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold text-purple-600">
                      {(metrics.analysis.averageProcessingTime / 1000).toFixed(1)}s
                    </div>
                    <div className="text-sm text-gray-500">Avg Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(metrics.cache).map(([cacheType, cacheStats]: [string, any]) => (
                <Card key={cacheType}>
                  <CardHeader>
                    <CardTitle className="capitalize">{cacheType} Cache</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span>{cacheStats.total || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valid:</span>
                      <span className="text-green-600">{cacheStats.valid || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expired:</span>
                      <span className="text-red-600">{cacheStats.expired || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Size:</span>
                      <span>{cacheStats.maxSize || 0}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Status Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(metrics.errors.byStatusCode).map(([code, count]) => (
                      <div key={code} className="flex justify-between items-center">
                        <Badge variant="outline">{code}</Badge>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Errors</CardTitle>
                  <CardDescription>Last 10 errors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.errors.recentErrors.slice(0, 10).map((error, i) => (
                      <div key={i} className="p-3 border rounded bg-red-50">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{error.endpoint}</span>
                          <span className="text-gray-500">{formatTimestamp(error.timestamp)}</span>
                        </div>
                        <div className="text-sm text-red-600 mt-1">{error.error}</div>
                        {error.requestId && (
                          <div className="text-xs text-gray-500 mt-1">Request: {error.requestId}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

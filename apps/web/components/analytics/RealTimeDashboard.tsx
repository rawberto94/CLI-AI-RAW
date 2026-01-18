'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Users,
  FileText,
  DollarSign,
  Server,
  Wifi,
  WifiOff,
  Bell,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardMetrics {
  contracts: {
    total: number;
    active: number;
    expiringSoon: number;
    recentlyCreated: number;
    byStatus: Record<string, number>;
    totalValue: number;
  };
  approvals: {
    pending: number;
    approved: number;
    rejected: number;
    avgProcessingTime: number;
    bottlenecks: Array<{ step: string; avgWait: number }>;
  };
  extraction: {
    processed: number;
    successRate: number;
    avgConfidence: number;
    fieldAccuracy: Record<string, number>;
  };
  users: {
    active: number;
    totalSessions: number;
    avgSessionDuration: number;
    topPages: Array<{ path: string; views: number }>;
  };
  system: {
    apiLatency: number;
    errorRate: number;
    throughput: number;
    activeConnections: number;
  };
}

interface AnomalyAlert {
  id: string;
  metricId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'spike' | 'drop' | 'trend' | 'threshold';
  message: string;
  value: number;
  expectedValue: number;
  deviation: number;
  timestamp: string;
  resolved: boolean;
}

interface RealTimeDashboardProps {
  className?: string;
  refreshInterval?: number;
  tenantId?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#94a3b8',
  chart: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
};

const STATUS_COLORS: Record<string, string> = {
  active: COLORS.success,
  draft: COLORS.muted,
  pending_approval: COLORS.warning,
  expired: COLORS.danger,
  terminated: COLORS.danger,
};

// ============================================================================
// COMPONENTS
// ============================================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  color?: string;
  className?: string;
}

function MetricCard({ title, value, subtitle, icon, trend, color = 'blue', className }: MetricCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
  };

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 text-sm">
                {trend.value >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span className={trend.value >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(trend.value)}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg', colorClasses[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusBadgeProps {
  connected: boolean;
}

function StatusBadge({ connected }: StatusBadgeProps) {
  return (
    <Badge
      variant={connected ? 'default' : 'destructive'}
      className="flex items-center gap-1"
    >
      {connected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Disconnected</span>
        </>
      )}
    </Badge>
  );
}

interface AlertCardProps {
  alert: AnomalyAlert;
  onDismiss?: (id: string) => void;
}

function AlertCard({ alert, onDismiss }: AlertCardProps) {
  const severityColors = {
    low: 'border-blue-200 bg-blue-50',
    medium: 'border-amber-200 bg-amber-50',
    high: 'border-orange-200 bg-orange-50',
    critical: 'border-red-200 bg-red-50',
  };

  const severityIcons = {
    low: <Activity className="h-4 w-4 text-blue-600" />,
    medium: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    high: <AlertTriangle className="h-4 w-4 text-orange-600" />,
    critical: <XCircle className="h-4 w-4 text-red-600" />,
  };

  return (
    <div className={cn('p-3 rounded-lg border', severityColors[alert.severity])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {severityIcons[alert.severity]}
          <div className="space-y-1">
            <p className="text-sm font-medium">{alert.message}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(alert.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDismiss(alert.id)}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RealTimeDashboard({
  className,
  refreshInterval = 30000,
  tenantId,
}: RealTimeDashboardProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch dashboard metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        action: 'dashboard',
        ...(tenantId && { tenantId }),
      });

      const response = await fetch(`/api/analytics/real-time?${params}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.data);
        setLastUpdated(new Date(data.timestamp));
        setConnected(true);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/real-time?action=alerts&limit=10');
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.data || []);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Initial load and refresh
  useEffect(() => {
    fetchMetrics();
    fetchAlerts();

    const interval = setInterval(() => {
      fetchMetrics();
      fetchAlerts();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchMetrics, fetchAlerts, refreshInterval]);

  // Handle manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchMetrics();
    fetchAlerts();
  };

  // Dismiss alert
  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  // Calculate derived data
  const contractStatusData = useMemo(() => {
    if (!metrics) return [];
    return Object.entries(metrics.contracts.byStatus).map(([status, count]) => ({
      name: status.replace(/_/g, ' '),
      value: count,
      color: STATUS_COLORS[status] || COLORS.muted,
    }));
  }, [metrics]);

  const approvalTrendData = useMemo(() => {
    if (!metrics) return [];
    return [
      { name: 'Pending', value: metrics.approvals.pending, color: COLORS.warning },
      { name: 'Approved', value: metrics.approvals.approved, color: COLORS.success },
      { name: 'Rejected', value: metrics.approvals.rejected, color: COLORS.danger },
    ];
  }, [metrics]);

  const systemHealthData = useMemo(() => {
    if (!metrics) return [];
    
    // Generate mock time-series data
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 300000).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      latency: metrics.system.apiLatency + Math.random() * 20 - 10,
      throughput: metrics.system.throughput + Math.random() * 200 - 100,
    }));
  }, [metrics]);

  if (loading && !metrics) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Real-Time Analytics</h2>
          <p className="text-muted-foreground">
            Live metrics and performance insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge connected={connected} />
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">Last 15m</SelectItem>
              <SelectItem value="1h">Last 1h</SelectItem>
              <SelectItem value="6h">Last 6h</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7d</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base">Active Alerts</CardTitle>
                <Badge variant="secondary">{alerts.length}</Badge>
              </div>
              <Button variant="ghost" size="sm">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {alerts.slice(0, 4).map(alert => (
                <AlertCard key={alert.id} alert={alert} onDismiss={dismissAlert} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Metrics Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Contracts"
              value={metrics?.contracts.total.toLocaleString() || '0'}
              subtitle={`${metrics?.contracts.active || 0} active`}
              icon={<FileText className="h-6 w-6" />}
              trend={{ value: 12, label: 'vs last month' }}
              color="blue"
            />
            <MetricCard
              title="Contract Value"
              value={`$${((metrics?.contracts.totalValue || 0) / 1000000).toFixed(1)}M`}
              subtitle="Total portfolio value"
              icon={<DollarSign className="h-6 w-6" />}
              trend={{ value: 8, label: 'vs last month' }}
              color="green"
            />
            <MetricCard
              title="Pending Approvals"
              value={metrics?.approvals.pending || 0}
              subtitle={`Avg ${metrics?.approvals.avgProcessingTime.toFixed(1)}h processing`}
              icon={<Clock className="h-6 w-6" />}
              color="amber"
            />
            <MetricCard
              title="Extraction Success"
              value={`${metrics?.extraction.successRate.toFixed(1)}%`}
              subtitle={`${metrics?.extraction.processed} processed`}
              icon={<Zap className="h-6 w-6" />}
              trend={{ value: 2.5, label: 'improvement' }}
              color="purple"
            />
          </div>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Contract Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Contract Status Distribution</CardTitle>
                <CardDescription>Current contract status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={contractStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {contractStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* System Performance */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
                <CardDescription>API latency and throughput over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={systemHealthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" fontSize={12} />
                      <YAxis yAxisId="left" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="latency"
                        name="Latency (ms)"
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.2}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="throughput"
                        name="Throughput"
                        stroke={COLORS.success}
                        fill={COLORS.success}
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Expiring Soon"
              value={metrics?.contracts.expiringSoon || 0}
              subtitle="Within next 90 days"
              icon={<AlertTriangle className="h-6 w-6" />}
              color="amber"
            />
            <MetricCard
              title="Recently Created"
              value={metrics?.contracts.recentlyCreated || 0}
              subtitle="Last 30 days"
              icon={<TrendingUp className="h-6 w-6" />}
              color="green"
            />
            <MetricCard
              title="Active Contracts"
              value={metrics?.contracts.active || 0}
              subtitle={`${Math.round(((metrics?.contracts.active || 0) / (metrics?.contracts.total || 1)) * 100)}% of total`}
              icon={<CheckCircle className="h-6 w-6" />}
              color="blue"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Approval Workflow Performance</CardTitle>
              <CardDescription>Average wait time by approval step</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.approvals.bottlenecks.map((bottleneck, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{bottleneck.step}</span>
                      <span className="text-muted-foreground">{bottleneck.avgWait.toFixed(1)}h avg</span>
                    </div>
                    <Progress 
                      value={Math.min((bottleneck.avgWait / 48) * 100, 100)} 
                      className={cn(
                        'h-2',
                        bottleneck.avgWait > 24 && '[&>div]:bg-red-500',
                        bottleneck.avgWait > 12 && bottleneck.avgWait <= 24 && '[&>div]:bg-amber-500'
                      )}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Approval Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={approvalTrendData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {approvalTrendData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="API Latency"
              value={`${metrics?.system.apiLatency.toFixed(0)}ms`}
              subtitle="95th percentile"
              icon={<Zap className="h-6 w-6" />}
              color="blue"
            />
            <MetricCard
              title="Error Rate"
              value={`${metrics?.system.errorRate.toFixed(2)}%`}
              subtitle="Last 24 hours"
              icon={<AlertTriangle className="h-6 w-6" />}
              color={metrics?.system.errorRate && metrics.system.errorRate > 1 ? 'red' : 'green'}
            />
            <MetricCard
              title="Throughput"
              value={metrics?.system.throughput.toLocaleString() || '0'}
              subtitle="Requests per hour"
              icon={<Activity className="h-6 w-6" />}
              color="purple"
            />
            <MetricCard
              title="Active Connections"
              value={metrics?.system.activeConnections || 0}
              subtitle="Current sessions"
              icon={<Server className="h-6 w-6" />}
              color="cyan"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Extraction Accuracy by Field</CardTitle>
              <CardDescription>AI extraction confidence by field type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.extraction.fieldAccuracy && 
                  Object.entries(metrics.extraction.fieldAccuracy)
                    .sort(([, a], [, b]) => b - a)
                    .map(([field, accuracy]) => (
                      <div key={field} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">
                            {field.replace(/_/g, ' ')}
                          </span>
                          <span className={cn(
                            accuracy >= 95 ? 'text-green-600' : 
                            accuracy >= 90 ? 'text-amber-600' : 'text-red-600'
                          )}>
                            {accuracy.toFixed(1)}%
                          </span>
                        </div>
                        <Progress 
                          value={accuracy} 
                          className={cn(
                            'h-2',
                            accuracy >= 95 && '[&>div]:bg-green-500',
                            accuracy >= 90 && accuracy < 95 && '[&>div]:bg-amber-500',
                            accuracy < 90 && '[&>div]:bg-red-500'
                          )}
                        />
                      </div>
                    ))
                }
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Active Users"
              value={metrics?.users.active || 0}
              subtitle="Currently online"
              icon={<Users className="h-6 w-6" />}
              color="blue"
            />
            <MetricCard
              title="Total Sessions"
              value={metrics?.users.totalSessions || 0}
              subtitle="Last 24 hours"
              icon={<Activity className="h-6 w-6" />}
              color="green"
            />
            <MetricCard
              title="Avg Session"
              value={`${metrics?.users.avgSessionDuration.toFixed(0)}m`}
              subtitle="Duration"
              icon={<Clock className="h-6 w-6" />}
              color="purple"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most visited pages in the last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.users.topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>
                      <span className="font-medium">{page.path}</span>
                    </div>
                    <Badge variant="secondary">{page.views} views</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Last updated: {lastUpdated?.toLocaleTimeString() || 'Never'}
        </span>
        <span>
          Auto-refresh every {refreshInterval / 1000}s
        </span>
      </div>
    </div>
  );
}

export default RealTimeDashboard;

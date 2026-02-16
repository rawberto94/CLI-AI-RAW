'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Zap,
  Shield,
  RefreshCw,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardMetrics {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  avgRiskScore: number;
  pendingApprovals: number;
  expiringThisMonth: number;
  trends: {
    contractsChange: number;
    valueChange: number;
    riskChange: number;
  };
}

const emptyMetrics: DashboardMetrics = {
  totalContracts: 0,
  activeContracts: 0,
  totalValue: 0,
  avgRiskScore: 0,
  pendingApprovals: 0,
  expiringThisMonth: 0,
  trends: { contractsChange: 0, valueChange: 0, riskChange: 0 },
};

const statusColors: Record<string, string> = { Active: '#10b981', Draft: '#f59e0b', Expired: '#ef4444', Pending: '#3b82f6' };
const riskColors: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444', Critical: '#dc2626' };

export function EnhancedDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [contractsByStatusData, setContractsByStatusData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [riskDistributionData, setRiskDistributionData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<{ month: string; contracts: number; value: number; risk: number }[]>([]);
  const [workflowData, setWorkflowData] = useState<{ stage: string; count: number }[]>([]);

  useEffect(() => {
    fetchMetrics();
    
  }, [timeframe]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/dashboard?timeframe=${timeframe}`);
      if (response.ok) {
        const raw = await response.json();
        const data = raw.data ?? raw;
        setMetrics(data.metrics ?? data);

        // Wire chart data from API response
        if (data.statusDistribution) {
          setContractsByStatusData(Object.entries(data.statusDistribution).map(([name, value]) => ({
            name, value: value as number, color: statusColors[name] || '#6b7280',
          })));
        } else if (data.contractsByStatus) {
          setContractsByStatusData(data.contractsByStatus.map((s: any) => ({
            name: s.name || s.status, value: s.value || s.count, color: statusColors[s.name || s.status] || '#6b7280',
          })));
        }

        if (data.riskDistribution) {
          const rd = Array.isArray(data.riskDistribution) ? data.riskDistribution : Object.entries(data.riskDistribution).map(([name, value]) => ({ name, value }));
          setRiskDistributionData(rd.map((r: any) => ({
            name: r.name || r.level, value: r.value || r.count, color: riskColors[r.name || r.level] || '#6b7280',
          })));
        }

        if (data.monthlyTrend || data.trends?.monthly) {
          const mt = data.monthlyTrend || data.trends.monthly;
          setMonthlyTrendData(mt.map((m: any) => ({
            month: m.month || m.label, contracts: m.contracts || m.count || 0, value: m.value || 0, risk: m.risk || m.avgRisk || 0,
          })));
        }

        if (data.workflowPipeline || data.workflow) {
          const wf = data.workflowPipeline || data.workflow;
          setWorkflowData(wf.map((w: any) => ({ stage: w.stage || w.name, count: w.count || w.value || 0 })));
        }
      } else {
        setMetrics(emptyMetrics);
      }
    } catch {
      setMetrics(emptyMetrics);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    try {
      const exportData = {
        generatedAt: new Date().toISOString(),
        timeframe,
        metrics: metrics || emptyMetrics,
        statusDistribution: contractsByStatusData,
        riskDistribution: riskDistributionData,
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard-analytics-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      toast.success('Dashboard data exported successfully');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  // monthlyTrendData and workflowData are now fetched from API in state above

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Loading analytics…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Analytics</h2>
          <p className="text-sm text-muted-foreground">Comprehensive CLM insights and metrics</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex gap-1 bg-muted p-1 rounded-md" role="group" aria-label="Timeframe">
            {(['7d', '30d', '90d', '1y'] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(tf)}
                aria-pressed={timeframe === tf}
              >
                {tf === '7d' ? '7 Days' : tf === '30d' ? '30 Days' : tf === '90d' ? '90 Days' : '1 Year'}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
            <Button onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contracts</p>
                <p className="text-3xl font-bold text-foreground mt-1">{metrics?.totalContracts ?? 0}</p>
                <div className="flex items-center gap-1 mt-2">
                  {(metrics?.trends.contractsChange ?? 0) > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-violet-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`text-sm font-medium ${(metrics?.trends.contractsChange ?? 0) > 0 ? 'text-violet-600' : 'text-destructive'}`}>
                    {Math.abs(metrics?.trends.contractsChange ?? 0)}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-3xl font-bold text-foreground mt-1">${(metrics?.totalValue ?? 0).toFixed(1)}M</p>
                <div className="flex items-center gap-1 mt-2">
                  {(metrics?.trends.valueChange ?? 0) > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-violet-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <span className={`text-sm font-medium ${(metrics?.trends.valueChange ?? 0) > 0 ? 'text-violet-600' : 'text-destructive'}`}>
                    {Math.abs(metrics?.trends.valueChange ?? 0)}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs last period</span>
                </div>
              </div>
              <div className="p-3 bg-primary/10 rounded-xl">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Risk Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{metrics?.avgRiskScore ?? 0}/100</p>
                <div className="flex items-center gap-1 mt-2">
                  {(metrics?.trends.riskChange ?? 0) < 0 ? (
                    <ArrowDownRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${(metrics?.trends.riskChange ?? 0) < 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(metrics?.trends.riskChange ?? 0)}%
                  </span>
                  <span className="text-sm text-gray-500">improvement</span>
                </div>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Actions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{metrics?.pendingApprovals ?? 0}</p>
                <div className="flex items-center gap-1 mt-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-gray-500">{metrics?.expiringThisMonth ?? 0} expiring soon</span>
                </div>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-violet-600" />
              Contract Growth Trend
            </CardTitle>
            <CardDescription>Monthly contract volume and value over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrendData}>
                <defs>
                  <linearGradient id="colorContracts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="contracts"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorContracts)"
                  name="Contracts"
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  name="Value ($M)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-600" />
              Risk Score Trend
            </CardTitle>
            <CardDescription>Average portfolio risk score over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="risk"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', r: 5 }}
                  name="Avg Risk Score"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-violet-600" />
              Contract Status Distribution
            </CardTitle>
            <CardDescription>Breakdown by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RePieChart>
                <Pie
                  data={contractsByStatusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {contractsByStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-600" />
              Risk Distribution
            </CardTitle>
            <CardDescription>Contracts by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={riskDistributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Bar dataKey="value" name="Contracts" radius={[8, 8, 0, 0]}>
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Workflow Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-600" />
            Workflow Pipeline
          </CardTitle>
          <CardDescription>Contracts by workflow stage</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={workflowData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="stage" type="category" stroke="#6b7280" />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Action Items */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-red-100 rounded">
                  <Clock className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">5 contracts expire in 7 days</p>
                  <p className="text-xs text-gray-600">$1.2M total value at risk</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 bg-red-100 rounded">
                  <Shield className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">3 high-risk contracts need review</p>
                  <p className="text-xs text-gray-600">Legal approval pending</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-yellow-100 rounded">
                  <Users className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">18 workflows awaiting approval</p>
                  <p className="text-xs text-gray-600">8 assigned to you</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 bg-yellow-100 rounded">
                  <FileText className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">12 signatures pending</p>
                  <p className="text-xs text-gray-600">Average 3 days remaining</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-green-100 rounded">
                  <DollarSign className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">$180K savings opportunity</p>
                  <p className="text-xs text-gray-600">Rate optimization available</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1 bg-green-100 rounded">
                  <Zap className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">23 contracts for auto-renewal</p>
                  <p className="text-xs text-gray-600">Set up automation</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



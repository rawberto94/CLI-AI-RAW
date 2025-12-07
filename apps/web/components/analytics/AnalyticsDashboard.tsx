/**
 * Analytics Dashboard
 * Comprehensive contract analytics and business intelligence
 */

'use client';

import { memo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Clock,
  AlertTriangle,
  Calendar,
  ArrowRight,
  Download,
  RefreshCw,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const MetricCard = memo(function MetricCard({
  title,
  value,
  change,
  changeLabel,
  icon: Icon,
  trend = 'neutral',
  color = 'blue',
}: MetricCardProps) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
  };

  const colorClass = colorClasses[color] ?? colorClasses.blue!;
  const { bg, text } = colorClass;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {change !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : trend === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : null}
                <span className={cn(
                  'text-sm font-medium',
                  trend === 'up' && 'text-green-600',
                  trend === 'down' && 'text-red-600',
                  trend === 'neutral' && 'text-slate-500'
                )}>
                  {change > 0 ? '+' : ''}{change}%
                </span>
                {changeLabel && (
                  <span className="text-sm text-slate-400">{changeLabel}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center', bg)}>
            <Icon className={cn('h-6 w-6', text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

interface CategoryData {
  name: string;
  count: number;
  value: number;
  percentage: number;
}

interface TimeSeriesData {
  period: string;
  contracts: number;
  value: number;
}

interface AnalyticsDashboardProps {
  className?: string;
}

export const AnalyticsDashboard = memo(function AnalyticsDashboard({
  className,
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<string>('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Demo data
  const categoryData: CategoryData[] = [
    { name: 'Master Service Agreements', count: 45, value: 12500000, percentage: 35 },
    { name: 'Vendor Contracts', count: 38, value: 8900000, percentage: 28 },
    { name: 'NDAs', count: 65, value: 0, percentage: 18 },
    { name: 'Employment Agreements', count: 22, value: 3200000, percentage: 12 },
    { name: 'Other', count: 15, value: 1400000, percentage: 7 },
  ];

  const timeSeriesData: TimeSeriesData[] = [
    { period: 'Jan', contracts: 12, value: 2400000 },
    { period: 'Feb', contracts: 15, value: 3100000 },
    { period: 'Mar', contracts: 18, value: 2800000 },
    { period: 'Apr', contracts: 14, value: 3500000 },
    { period: 'May', contracts: 22, value: 4200000 },
    { period: 'Jun', contracts: 19, value: 3800000 },
  ];

  const statusDistribution = [
    { status: 'Active', count: 85, color: 'bg-green-500' },
    { status: 'Pending Review', count: 23, color: 'bg-yellow-500' },
    { status: 'Draft', count: 12, color: 'bg-slate-400' },
    { status: 'Expired', count: 8, color: 'bg-red-500' },
  ];

  const riskDistribution = [
    { level: 'Low', count: 92, color: 'bg-green-500', percentage: 72 },
    { level: 'Medium', count: 28, color: 'bg-yellow-500', percentage: 22 },
    { level: 'High', count: 8, color: 'bg-red-500', percentage: 6 },
  ];

  const upcomingDeadlines = [
    { contract: 'Acme Corp - MSA', daysRemaining: 7, type: 'expiration' },
    { contract: 'TechVenture NDA', daysRemaining: 14, type: 'renewal' },
    { contract: 'Global Supplies Agreement', daysRemaining: 21, type: 'review' },
    { contract: 'Contractor Agreement - JSmith', daysRemaining: 30, type: 'expiration' },
  ];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsRefreshing(false);
  };

  const totalContracts = statusDistribution.reduce((sum, s) => sum + s.count, 0);
  const maxBar = Math.max(...timeSeriesData.map(d => d.contracts));

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Analytics Dashboard
          </h2>
          <p className="text-slate-600 mt-1">
            Contract intelligence and business insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Contracts"
          value="185"
          change={12}
          changeLabel="vs last month"
          icon={FileText}
          trend="up"
          color="blue"
        />
        <MetricCard
          title="Total Value"
          value="$26M"
          change={8}
          changeLabel="vs last month"
          icon={DollarSign}
          trend="up"
          color="green"
        />
        <MetricCard
          title="Avg Processing Time"
          value="2.4h"
          change={-15}
          changeLabel="improvement"
          icon={Clock}
          trend="up"
          color="purple"
        />
        <MetricCard
          title="High Risk Contracts"
          value="8"
          change={-25}
          changeLabel="vs last month"
          icon={AlertTriangle}
          trend="up"
          color="red"
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contracts Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Contracts Over Time</CardTitle>
            <CardDescription>Number of contracts processed per month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {timeSeriesData.map((data, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                    style={{ height: `${(data.contracts / maxBar) * 100}%` }}
                  />
                  <span className="text-xs text-slate-500">{data.period}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-slate-500">Total: {timeSeriesData.reduce((s, d) => s + d.contracts, 0)} contracts</span>
              <Badge variant="outline" className="text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                +18% growth
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Contract Status</CardTitle>
            <CardDescription>Distribution by current status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusDistribution.map((status, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{status.status}</span>
                    <span className="text-sm text-slate-500">{status.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', status.color)}
                      style={{ width: `${(status.count / totalContracts) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-slate-500">Total: {totalContracts} contracts</span>
              <Button variant="link" size="sm" className="p-0 h-auto">
                View all <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Category Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Contracts by type and value</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryData.map((cat, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <span className="text-sm text-slate-500">{cat.count} contracts</span>
                    </div>
                    <Progress value={cat.percentage} className="h-2" />
                  </div>
                  {cat.value > 0 && (
                    <div className="w-24 text-right">
                      <span className="text-sm font-medium text-green-600">
                        ${(cat.value / 1000000).toFixed(1)}M
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Risk Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Contracts by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {riskDistribution.map((risk, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={cn('h-4 w-4 rounded-full', risk.color)} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{risk.level} Risk</span>
                      <span className="text-sm text-slate-500">{risk.percentage}%</span>
                    </div>
                    <span className="text-xs text-slate-400">{risk.count} contracts</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-700">Risk Score</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-3 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full">
                  <div 
                    className="h-5 w-5 bg-white border-2 border-slate-300 rounded-full shadow -mt-1"
                    style={{ marginLeft: 'calc(25% - 10px)' }}
                  />
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-2">Overall portfolio risk: <strong className="text-green-600">Low</strong></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Upcoming Deadlines</CardTitle>
            <CardDescription>Contracts requiring attention</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {upcomingDeadlines.map((deadline, i) => (
              <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center',
                    deadline.daysRemaining <= 7 ? 'bg-red-100 text-red-600' :
                    deadline.daysRemaining <= 14 ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  )}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{deadline.contract}</p>
                    <p className="text-sm text-slate-500 capitalize">{deadline.type}</p>
                  </div>
                </div>
                <Badge variant={
                  deadline.daysRemaining <= 7 ? 'destructive' :
                  deadline.daysRemaining <= 14 ? 'default' : 'secondary'
                }>
                  {deadline.daysRemaining} days
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default AnalyticsDashboard;

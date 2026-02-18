/**
 * Analytics Dashboard
 * Comprehensive contract analytics and business intelligence
 */

'use client';

import { memo, useState, useEffect, useCallback } from 'react';
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
    blue: { bg: 'bg-violet-100', text: 'text-violet-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    purple: { bg: 'bg-violet-100', text: 'text-violet-600' },
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
  const [loading, setLoading] = useState(true);

  // State for API data
  const [totalContracts, setTotalContracts] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  const [avgProcessingTime, setAvgProcessingTime] = useState(0);
  const [highRiskCount, setHighRiskCount] = useState(0);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{status: string; count: number; color: string}[]>([]);
  const [riskDistribution, setRiskDistribution] = useState<{level: string; count: number; color: string; percentage: number}[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<{contract: string; daysRemaining: number; type: string}[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?timeframe=${timeRange}`);
      if (!res.ok) return;
      const json = await res.json();
      const m = json.metrics || json.data?.metrics || {};

      setTotalContracts(m.totalContracts ?? 0);
      setTotalValue(m.totalValue ?? 0);
      setAvgProcessingTime(m.avgProcessingTime ?? m.avgRiskScore ?? 0);
      setHighRiskCount(m.highRiskContracts ?? 0);

      if (m.statusDistribution) {
        const colors: Record<string, string> = { active: 'bg-green-500', draft: 'bg-slate-400', pending: 'bg-yellow-500', expired: 'bg-red-500' };
        setStatusDistribution(
          Object.entries(m.statusDistribution).map(([status, count]) => ({
            status: status.charAt(0).toUpperCase() + status.slice(1),
            count: count as number,
            color: colors[status.toLowerCase()] || 'bg-slate-400',
          }))
        );
      }

      if (m.trends) {
        setTimeSeriesData(
          (Array.isArray(m.trends) ? m.trends : []).map((t: any) => ({
            period: t.period || t.month || '',
            contracts: t.contracts || t.count || 0,
            value: t.value || 0,
          }))
        );
      }

      if (m.categories) {
        setCategoryData(
          (Array.isArray(m.categories) ? m.categories : []).map((c: any) => ({
            name: c.name || c.type || 'Other',
            count: c.count || 0,
            value: c.value || 0,
            percentage: c.percentage || 0,
          }))
        );
      }

      if (m.riskDistribution) {
        const rcolors: Record<string, string> = { low: 'bg-green-500', medium: 'bg-yellow-500', high: 'bg-red-500' };
        setRiskDistribution(
          Object.entries(m.riskDistribution).map(([level, count]) => ({
            level: level.charAt(0).toUpperCase() + level.slice(1),
            count: count as number,
            color: rcolors[level.toLowerCase()] || 'bg-slate-400',
            percentage: totalContracts > 0 ? Math.round(((count as number) / totalContracts) * 100) : 0,
          }))
        );
      }

      if (m.upcomingDeadlines) {
        setUpcomingDeadlines(
          (Array.isArray(m.upcomingDeadlines) ? m.upcomingDeadlines : []).map((d: any) => ({
            contract: d.contract || d.contractName || 'Unknown',
            daysRemaining: d.daysRemaining ?? 0,
            type: d.type || 'expiration',
          }))
        );
      }
    } catch {
      // Could not fetch analytics
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [timeRange, totalContracts]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => fetchAnalytics();

  const computedTotalContracts = statusDistribution.reduce((sum, s) => sum + s.count, 0);
  const maxBar = Math.max(...timeSeriesData.map(d => d.contracts));

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-violet-600" />
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
          value={totalContracts.toLocaleString()}
          icon={FileText}
          trend="up"
          color="blue"
        />
        <MetricCard
          title="Total Value"
          value={totalValue >= 1_000_000 ? `$${(totalValue / 1_000_000).toFixed(1)}M` : `$${totalValue.toLocaleString()}`}
          icon={DollarSign}
          trend="up"
          color="green"
        />
        <MetricCard
          title="Avg Risk Score"
          value={avgProcessingTime.toFixed(1)}
          icon={Clock}
          trend="neutral"
          color="purple"
        />
        <MetricCard
          title="High Risk Contracts"
          value={highRiskCount.toString()}
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
                    className="w-full bg-violet-500 rounded-t transition-all hover:bg-violet-600"
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
                      style={{ width: `${(status.count / computedTotalContracts) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex items-center justify-between">
              <span className="text-sm text-slate-500">Total: {computedTotalContracts} contracts</span>
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
                <div className="flex-1 h-3 bg-gradient-to-r from-violet-500 via-yellow-500 to-red-500 rounded-full">
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
                    'bg-violet-100 text-violet-600'
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

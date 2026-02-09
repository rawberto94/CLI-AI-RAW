/**
 * Dashboard Overview Component
 * Executive-level metrics and insights dashboard
 */

'use client';

import { memo, useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

interface DashboardMetrics {
  totalContracts: number;
  activeContracts: number;
  expiringContracts: number;
  atRiskContracts: number;
  totalValue: number;
  processingQueue: number;
  completedToday: number;
  avgProcessingTime: number;
  trends: {
    contracts: { value: number; change: number };
    value: { value: number; change: number };
    risk: { value: number; change: number };
  };
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentActivity: { id: string; action: string; contract: string; time: Date }[];
}

interface DashboardOverviewProps {
  className?: string;
}

// Empty state when no data available
function getEmptyMetrics(): DashboardMetrics {
  return {
    totalContracts: 0,
    activeContracts: 0,
    expiringContracts: 0,
    atRiskContracts: 0,
    totalValue: 0,
    processingQueue: 0,
    completedToday: 0,
    avgProcessingTime: 0,
    trends: {
      contracts: { value: 0, change: 0 },
      value: { value: 0, change: 0 },
      risk: { value: 0, change: 0 },
    },
    byType: [],
    byStatus: [],
    recentActivity: [],
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value}`;
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export const DashboardOverview = memo(function DashboardOverview({
  className,
}: DashboardOverviewProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dashboard/metrics');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        setMetrics(getEmptyMetrics());
      }
    } catch {
      setMetrics(getEmptyMetrics());
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const maxTypeCount = Math.max(...metrics.byType.map(t => t.count));

  return (
    <div className={cn('space-y-6', className)}>
      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Contracts</p>
                <p className="text-3xl font-bold mt-1">{metrics.totalContracts.toLocaleString()}</p>
                <div className="flex items-center gap-1 mt-2">
                  {metrics.trends.contracts.change > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className={cn(
                    'text-sm font-medium',
                    metrics.trends.contracts.change > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {Math.abs(metrics.trends.contracts.change)}%
                  </span>
                  <span className="text-xs text-slate-400">vs last month</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-violet-100">
                <FileText className="h-6 w-6 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Value</p>
                <p className="text-3xl font-bold mt-1">{formatCurrency(metrics.totalValue)}</p>
                <div className="flex items-center gap-1 mt-2">
                  {metrics.trends.value.change > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-600" />
                  )}
                  <span className={cn(
                    'text-sm font-medium',
                    metrics.trends.value.change > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {Math.abs(metrics.trends.value.change)}%
                  </span>
                  <span className="text-xs text-slate-400">vs last month</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-green-100">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expiring Soon</p>
                <p className="text-3xl font-bold mt-1 text-yellow-600">{metrics.expiringContracts}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Within next 30 days
                </p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-100">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">At Risk</p>
                <p className="text-3xl font-bold mt-1 text-red-600">{metrics.atRiskContracts}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">
                    {Math.abs(metrics.trends.risk.change)}%
                  </span>
                  <span className="text-xs text-slate-400">improved</span>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Contracts by Type */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-600" />
              Contracts by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics.byType.map(({ type, count }) => (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{type}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <Progress 
                    value={(count / maxTypeCount) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-600" />
              Processing Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-violet-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">In Queue</p>
                <p className="text-2xl font-bold text-violet-600">{metrics.processingQueue}</p>
              </div>
              <Clock className="h-8 w-8 text-violet-400" />
            </div>
            <div className="p-4 rounded-lg bg-green-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">{metrics.completedToday}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <div className="p-4 rounded-lg bg-slate-50 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Avg. Processing Time</p>
                <p className="text-2xl font-bold">{metrics.avgProcessingTime}s</p>
              </div>
              <TrendingUp className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-3 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-violet-600" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.byStatus.map(({ status, count }) => {
                const colors: Record<string, string> = {
                  Active: 'bg-green-500',
                  Pending: 'bg-yellow-500',
                  Expired: 'bg-red-500',
                  Draft: 'bg-slate-400',
                };
                const percentage = ((count / metrics.totalContracts) * 100).toFixed(1);
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={cn('h-3 w-3 rounded-full', colors[status] || 'bg-slate-400')} />
                    <span className="flex-1 text-sm">{status}</span>
                    <span className="text-sm text-slate-500">{count}</span>
                    <span className="text-xs text-slate-400 w-12 text-right">{percentage}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-violet-600" />
              Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/audit">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentActivity.map(activity => {
                const actionColors: Record<string, string> = {
                  Created: 'bg-green-100 text-green-700',
                  Processed: 'bg-violet-100 text-violet-700',
                  Analyzed: 'bg-violet-100 text-violet-700',
                  Exported: 'bg-orange-100 text-orange-700',
                  Updated: 'bg-slate-100 text-slate-700',
                };
                const minutesAgo = Math.floor((Date.now() - activity.time.getTime()) / 60000);
                const timeText = minutesAgo < 60 
                  ? `${minutesAgo}m ago` 
                  : `${Math.floor(minutesAgo / 60)}h ago`;

                return (
                  <div 
                    key={activity.id} 
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <Badge variant="outline" className={actionColors[activity.action] || ''}>
                      {activity.action}
                    </Badge>
                    <span className="flex-1 text-sm truncate">{activity.contract}</span>
                    <span className="text-xs text-slate-400">{timeText}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

/**
 * ContractAnalyticsCards Component
 * 
 * Analytics dashboard cards showing contract metrics, trends, and insights.
 * Can be used as a summary header or full analytics section.
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  DollarSign,
  FileText,
  Clock,
  Shield,
  BarChart3,
  PieChart,
  Activity,
  ArrowRight,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  useContractAnalytics,
  type AnalyticsContract as Contract,
  type ContractInsight,
} from '@/hooks/use-contract-analytics';

// ============================================================================
// Types
// ============================================================================

interface ContractAnalyticsCardsProps {
  contracts: Contract[];
  onNavigateToFilter?: (filters: Record<string, any>) => void;
  className?: string;
  variant?: 'compact' | 'full' | 'dashboard';
}

// ============================================================================
// Helper Components
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon, trend, color, onClick }: StatCardProps) {
  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <Card 
        className={cn(
          'relative overflow-hidden transition-shadow',
          onClick && 'cursor-pointer hover:shadow-md'
        )}
        onClick={onClick}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
              )}
              {trend && (
                <div className={cn(
                  'flex items-center gap-1 mt-2 text-xs font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {Math.abs(trend.value)}% from last month
                </div>
              )}
            </div>
            <div 
              className={cn(
                'p-3 rounded-lg',
                color || 'bg-primary/10 text-primary'
              )}
            >
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface InsightCardProps {
  insight: ContractInsight;
  onAction?: () => void;
}

function InsightCard({ insight, onAction }: InsightCardProps) {
  const iconMap = {
    critical: <AlertCircle className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />,
    success: <CheckCircle2 className="h-5 w-5" />,
  };

  const colorMap = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    success: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border',
      colorMap[insight.type]
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {iconMap[insight.type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{insight.title}</p>
        <p className="text-sm opacity-80 mt-0.5">{insight.description}</p>
        {insight.action && onAction && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2 -ml-2"
            onClick={onAction}
          >
            {insight.action.label}
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface RiskMeterProps {
  distribution: {
    low: number;
    medium: number;
    high: number;
    unknown: number;
  };
  total: number;
}

function RiskMeter({ distribution, total }: RiskMeterProps) {
  const lowPercent = (distribution.low / total) * 100;
  const mediumPercent = (distribution.medium / total) * 100;
  const highPercent = (distribution.high / total) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full overflow-hidden bg-muted flex">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${lowPercent}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${mediumPercent}%` }}
          />
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${highPercent}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-muted-foreground">Low ({distribution.low})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">Medium ({distribution.medium})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-muted-foreground">High ({distribution.high})</span>
        </div>
      </div>
    </div>
  );
}

interface MiniBarChartProps {
  data: Array<{ period: string; value: number }>;
  height?: number;
}

function MiniBarChart({ data, height = 60 }: MiniBarChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, index) => (
        <TooltipProvider key={item.period}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer"
                style={{
                  height: `${(item.value / maxValue) * 100}%`,
                  minHeight: item.value > 0 ? 4 : 0,
                }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                {item.period}: {item.value} contracts
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractAnalyticsCards({
  contracts,
  onNavigateToFilter,
  className,
  variant = 'full',
}: ContractAnalyticsCardsProps) {
  const {
    stats,
    monthlyTrends,
    expirationForecast,
    riskDistribution,
    topVendors,
    insights,
    criticalInsights,
  } = useContractAnalytics(contracts);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Calculate trend from monthly data
  const calculateTrend = () => {
    if (monthlyTrends.length < 2) return null;
    const current = monthlyTrends[monthlyTrends.length - 1]?.count ?? 0;
    const previous = monthlyTrends[monthlyTrends.length - 2]?.count ?? 0;
    if (previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return { value: Math.round(change), isPositive: change >= 0 };
  };

  const trend = calculateTrend();

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{stats.total} Contracts</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{formatCurrency(stats.totalValue)}</span>
        </div>
        {stats.expiringThisMonth > 0 && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            <Clock className="h-3 w-3 mr-1" />
            {stats.expiringThisMonth} expiring
          </Badge>
        )}
        {criticalInsights.length > 0 && (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {criticalInsights.length} alerts
          </Badge>
        )}
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Contracts"
            value={stats.total}
            subtitle={`${stats.byStatus['active'] || 0} active`}
            icon={<FileText className="h-5 w-5" />}
            trend={trend ?? undefined}
            onClick={() => onNavigateToFilter?.({})}
          />
          <StatCard
            title="Total Value"
            value={formatCurrency(stats.totalValue)}
            subtitle={`Avg ${formatCurrency(stats.averageValue)}`}
            icon={<DollarSign className="h-5 w-5" />}
            color="bg-green-100 text-green-700"
          />
          <StatCard
            title="Expiring Soon"
            value={stats.expiringThisMonth}
            subtitle="This month"
            icon={<Calendar className="h-5 w-5" />}
            color="bg-amber-100 text-amber-700"
            onClick={() => onNavigateToFilter?.({ expiringWithin: 30 })}
          />
          <StatCard
            title="High Risk"
            value={riskDistribution.high}
            subtitle={`${Math.round((riskDistribution.high / stats.total) * 100)}% of total`}
            icon={<Shield className="h-5 w-5" />}
            color="bg-red-100 text-red-700"
            onClick={() => onNavigateToFilter?.({ riskLevel: 'high' })}
          />
        </div>

        {/* Insights */}
        {criticalInsights.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">Attention Required</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {criticalInsights.slice(0, 3).map((insight) => (
                <InsightCard
                  key={insight.id}
                  insight={insight}
                  onAction={() => insight.action && onNavigateToFilter?.(insight.action.filters)}
                />
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('space-y-6', className)}>
      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Contracts"
          value={stats.total}
          subtitle={`${stats.byStatus['active'] || 0} active`}
          icon={<FileText className="h-5 w-5" />}
          trend={trend ?? undefined}
          onClick={() => onNavigateToFilter?.({})}
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(stats.totalValue)}
          subtitle={`Avg ${formatCurrency(stats.averageValue)}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          title="Expiring This Month"
          value={stats.expiringThisMonth}
          subtitle={`${stats.expiringThisQuarter} this quarter`}
          icon={<Calendar className="h-5 w-5" />}
          color="bg-amber-100 text-amber-700"
          onClick={() => onNavigateToFilter?.({ expiringWithin: 30 })}
        />
        <StatCard
          title="New This Month"
          value={stats.newThisMonth}
          subtitle="Recently added"
          icon={<Activity className="h-5 w-5" />}
          color="bg-blue-100 text-blue-700"
          onClick={() => onNavigateToFilter?.({ createdWithin: 30 })}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Monthly Trend</CardTitle>
                <CardDescription>Contracts created over time</CardDescription>
              </div>
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <MiniBarChart
              data={monthlyTrends.map((t) => ({ period: t.period, value: t.count }))}
              height={80}
            />
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Risk Distribution</CardTitle>
                <CardDescription>Portfolio risk breakdown</CardDescription>
              </div>
              <Shield className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <RiskMeter distribution={riskDistribution} total={stats.total} />
          </CardContent>
        </Card>
      </div>

      {/* Expiration Forecast */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Expiration Forecast</CardTitle>
              <CardDescription>Upcoming contract expirations</CardDescription>
            </div>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-4">
            {expirationForecast.map((month) => (
              <div
                key={month.month}
                className={cn(
                  'text-center p-3 rounded-lg cursor-pointer transition-colors',
                  month.count > 0 ? 'bg-amber-50 hover:bg-amber-100' : 'bg-muted/50'
                )}
                onClick={() => onNavigateToFilter?.({ expiringMonth: month.month })}
              >
                <p className="text-xs text-muted-foreground">
                  {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short' })}
                </p>
                <p className="text-lg font-bold mt-1">{month.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(month.value)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Insights & Recommendations</CardTitle>
                <CardDescription>AI-powered analysis of your contracts</CardDescription>
              </div>
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.slice(0, 5).map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onAction={() => insight.action && onNavigateToFilter?.(insight.action.filters)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Top Vendors */}
      {topVendors.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Top Vendors</CardTitle>
                <CardDescription>By contract value</CardDescription>
              </div>
              <PieChart className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topVendors.slice(0, 5).map((vendor, index) => (
                <div
                  key={vendor.vendor}
                  className="flex items-center gap-4 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors"
                  onClick={() => onNavigateToFilter?.({ vendor: vendor.vendor })}
                >
                  <div className="flex-shrink-0 w-6 text-center text-sm font-medium text-muted-foreground">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{vendor.vendor}</p>
                    <p className="text-xs text-muted-foreground">
                      {vendor.contractCount} contracts • {vendor.activeCount} active
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(vendor.totalValue)}</p>
                    {vendor.expiringCount > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {vendor.expiringCount} expiring
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ContractAnalyticsCards;

'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  Users,
  Calendar,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
  Download,
  RefreshCw,
  Layers,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
export interface ApprovalMetrics {
  totalApprovals: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageProcessingTime: number; // hours
  averageProcessingTimeTrend: number; // percentage change
  approvalRate: number; // percentage
  approvalRateTrend: number; // percentage change
  slaComplianceRate: number; // percentage
  slaComplianceTrend: number; // percentage change
  escalationRate: number; // percentage
  escalationTrend: number; // percentage change
}

export interface ProcessingTimeData {
  label: string;
  value: number;
  benchmark: number;
}

export interface BottleneckData {
  step: string;
  role: string;
  avgTime: number;
  count: number;
  percentageOfTotal: number;
}

export interface ApproverPerformance {
  id: string;
  name: string;
  role: string;
  approvalCount: number;
  avgResponseTime: number;
  approvalRate: number;
  slaCompliance: number;
}

export interface TrendDataPoint {
  date: string;
  approved: number;
  rejected: number;
  pending: number;
}

// Mock data generator
function generateMockMetrics(): ApprovalMetrics {
  return {
    totalApprovals: 1247,
    pendingCount: 23,
    approvedCount: 1089,
    rejectedCount: 135,
    averageProcessingTime: 18.5,
    averageProcessingTimeTrend: -12.3,
    approvalRate: 87.4,
    approvalRateTrend: 2.1,
    slaComplianceRate: 92.3,
    slaComplianceTrend: 5.6,
    escalationRate: 8.2,
    escalationTrend: -3.4
  };
}

function generateMockProcessingTime(): ProcessingTimeData[] {
  return [
    { label: 'Department Review', value: 4.2, benchmark: 4 },
    { label: 'Legal Review', value: 8.1, benchmark: 6 },
    { label: 'Finance Approval', value: 3.8, benchmark: 4 },
    { label: 'Executive Sign-off', value: 2.4, benchmark: 2 }
  ];
}

function generateMockBottlenecks(): BottleneckData[] {
  return [
    { step: 'Legal Review', role: 'Legal Team', avgTime: 8.1, count: 156, percentageOfTotal: 43.7 },
    { step: 'Department Review', role: 'Dept. Manager', avgTime: 4.2, count: 89, percentageOfTotal: 22.6 },
    { step: 'Finance Approval', role: 'Finance Director', avgTime: 3.8, count: 67, percentageOfTotal: 20.5 },
    { step: 'Executive Sign-off', role: 'Executive', avgTime: 2.4, count: 32, percentageOfTotal: 13.2 }
  ];
}

function generateMockApprovers(): ApproverPerformance[] {
  return [
    { id: '1', name: 'John Smith', role: 'Legal Manager', approvalCount: 234, avgResponseTime: 4.2, approvalRate: 92, slaCompliance: 96 },
    { id: '2', name: 'Sarah Johnson', role: 'Finance Director', approvalCount: 189, avgResponseTime: 2.8, approvalRate: 88, slaCompliance: 98 },
    { id: '3', name: 'Mike Chen', role: 'Dept. Manager', approvalCount: 156, avgResponseTime: 5.1, approvalRate: 94, slaCompliance: 89 },
    { id: '4', name: 'Emily Davis', role: 'Compliance Officer', approvalCount: 142, avgResponseTime: 6.3, approvalRate: 85, slaCompliance: 82 },
    { id: '5', name: 'Robert Wilson', role: 'Executive', approvalCount: 98, avgResponseTime: 1.5, approvalRate: 91, slaCompliance: 99 }
  ];
}

function generateMockTrends(): TrendDataPoint[] {
  return [
    { date: 'Jan', approved: 78, rejected: 12, pending: 8 },
    { date: 'Feb', approved: 92, rejected: 15, pending: 6 },
    { date: 'Mar', approved: 105, rejected: 11, pending: 12 },
    { date: 'Apr', approved: 88, rejected: 14, pending: 9 },
    { date: 'May', approved: 112, rejected: 8, pending: 5 },
    { date: 'Jun', approved: 125, rejected: 10, pending: 4 }
  ];
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  className?: string;
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  trend, 
  trendLabel,
  icon: Icon, 
  iconColor = 'text-primary',
  className 
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return <Minus size={14} />;
    return trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />;
  };

  const getTrendColor = () => {
    if (!trend) return 'text-muted-foreground';
    // For some metrics like processing time, lower is better
    const isPositiveGood = !title.toLowerCase().includes('time') && !title.toLowerCase().includes('escalation');
    const isGood = isPositiveGood ? trend > 0 : trend < 0;
    return isGood ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  return (
    <Card className={cn('relative overflow-hidden', className)} role="region" aria-label={title}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground" id={`stat-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</p>
            <p className="text-3xl font-bold" aria-describedby={`stat-${title.replace(/\s+/g, '-').toLowerCase()}`}>{value}</p>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            )}
            {trend !== undefined && (
              <div className={cn('flex items-center gap-1 text-sm', getTrendColor())} aria-label={`${trend > 0 ? 'Up' : 'Down'} ${Math.abs(trend)}% compared to last period`}>
                <span aria-hidden="true">{getTrendIcon()}</span>
                <span>{Math.abs(trend)}%</span>
                {trendLabel && <span className="text-muted-foreground">vs last period</span>}
              </div>
            )}
          </div>
          <div className={cn('p-3 rounded-lg bg-muted/50', iconColor)} aria-hidden="true">
            <Icon size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Processing Time Chart Component
interface ProcessingTimeChartProps {
  data: ProcessingTimeData[];
  className?: string;
}

function ProcessingTimeChart({ data, className }: ProcessingTimeChartProps) {
  const maxValue = Math.max(...data.map(d => Math.max(d.value, d.benchmark)));

  return (
    <Card className={className} role="region" aria-label="Processing time chart">
      <CardHeader>
        <CardTitle className="text-lg">Processing Time by Step</CardTitle>
        <CardDescription>Average hours to complete each approval step</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4" role="list" aria-label="Processing times by step">
        {data.map((item, index) => (
          <div key={index} className="space-y-2" role="listitem" aria-label={`${item.label}: ${item.value} hours, target ${item.benchmark} hours`}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'font-mono',
                  item.value > item.benchmark ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                )}>
                  {item.value}h
                </span>
                <span className="text-muted-foreground">/ {item.benchmark}h target</span>
              </div>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              {/* Benchmark line */}
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50 z-10"
                style={{ left: `${(item.benchmark / maxValue) * 100}%` }}
              />
              {/* Actual value bar */}
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  item.value > item.benchmark ? 'bg-red-500' : 'bg-green-500'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / maxValue) * 100}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              />
            </div>
          </div>
        ))}
        <div className="flex items-center justify-center gap-4 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Within target</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Above target</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-muted-foreground/50" />
            <span>Target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Bottleneck Analysis Component
interface BottleneckAnalysisProps {
  data: BottleneckData[];
  className?: string;
}

function BottleneckAnalysis({ data, className }: BottleneckAnalysisProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Bottleneck Analysis</CardTitle>
            <CardDescription>Steps causing the most delays</CardDescription>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle size={18} className="text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent>
                Steps are ranked by their contribution to total processing time
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => (
            <div 
              key={index}
              className={cn(
                'flex items-center gap-4 p-3 rounded-lg',
                index === 0 && 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                index === 0 ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
              )}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.step}</span>
                  <Badge variant={index === 0 ? 'destructive' : 'secondary'}>
                    {item.avgTime}h avg
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-1 text-sm text-muted-foreground">
                  <span>{item.role}</span>
                  <span>{item.count} pending • {item.percentageOfTotal}% of delays</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Approver Leaderboard Component
interface ApproverLeaderboardProps {
  data: ApproverPerformance[];
  className?: string;
}

function ApproverLeaderboard({ data, className }: ApproverLeaderboardProps) {
  const [sortBy, setSortBy] = useState<'approvalCount' | 'avgResponseTime' | 'slaCompliance'>('slaCompliance');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === 'avgResponseTime') {
        return a[sortBy] - b[sortBy]; // Lower is better
      }
      return b[sortBy] - a[sortBy]; // Higher is better
    });
  }, [data, sortBy]);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Approver Performance</CardTitle>
            <CardDescription>Individual approver metrics</CardDescription>
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slaCompliance">SLA Compliance</SelectItem>
              <SelectItem value="approvalCount">Volume</SelectItem>
              <SelectItem value="avgResponseTime">Response Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedData.map((approver, index) => (
            <div 
              key={approver.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                index === 0 && 'bg-yellow-500 text-white',
                index === 1 && 'bg-gray-400 text-white',
                index === 2 && 'bg-amber-600 text-white',
                index > 2 && 'bg-muted text-muted-foreground'
              )}>
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{approver.name}</span>
                  <Badge variant="outline" className="text-xs">{approver.role}</Badge>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>{approver.approvalCount} approvals</span>
                  <span>{approver.avgResponseTime}h avg</span>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  'text-lg font-bold',
                  approver.slaCompliance >= 95 ? 'text-green-600 dark:text-green-400' :
                  approver.slaCompliance >= 85 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                )}>
                  {approver.slaCompliance}%
                </div>
                <div className="text-xs text-muted-foreground">SLA</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Trend Chart Component (simplified)
interface TrendChartProps {
  data: TrendDataPoint[];
  className?: string;
}

function TrendChart({ data, className }: TrendChartProps) {
  const maxValue = Math.max(...data.flatMap(d => [d.approved, d.rejected, d.pending]));

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Approval Trends</CardTitle>
        <CardDescription>Monthly approval activity over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2 h-48">
          {data.map((point, index) => {
            const total = point.approved + point.rejected + point.pending;
            const approvedHeight = (point.approved / maxValue) * 100;
            const rejectedHeight = (point.rejected / maxValue) * 100;
            const pendingHeight = (point.pending / maxValue) * 100;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex flex-col w-full gap-0.5" style={{ height: '160px' }}>
                  <motion.div
                    className="w-full bg-yellow-500 rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: `${pendingHeight}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                  <motion.div
                    className="w-full bg-red-500"
                    initial={{ height: 0 }}
                    animate={{ height: `${rejectedHeight}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                  <motion.div
                    className="w-full bg-green-500 rounded-b"
                    initial={{ height: 0 }}
                    animate={{ height: `${approvedHeight}%` }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{point.date}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Rejected</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500" />
            <span>Pending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Dashboard Component
interface ApprovalAnalyticsDashboardProps {
  className?: string;
}

export function ApprovalAnalyticsDashboard({ className }: ApprovalAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // In production, these would come from API calls
  const metrics = generateMockMetrics();
  const processingTimeData = generateMockProcessingTime();
  const bottleneckData = generateMockBottlenecks();
  const approverData = generateMockApprovers();
  const trendData = generateMockTrends();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Approval Analytics</h2>
          <p className="text-muted-foreground">
            Monitor approval workflow performance and identify bottlenecks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          </Button>
          <Button variant="outline">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Approvals"
          value={metrics.totalApprovals.toLocaleString()}
          subtitle={`${metrics.pendingCount} pending`}
          icon={Layers}
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Avg Processing Time"
          value={`${metrics.averageProcessingTime}h`}
          trend={metrics.averageProcessingTimeTrend}
          trendLabel="vs last period"
          icon={Clock}
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Approval Rate"
          value={`${metrics.approvalRate}%`}
          trend={metrics.approvalRateTrend}
          trendLabel="vs last period"
          icon={CheckCircle2}
          iconColor="text-green-600 dark:text-green-400"
        />
        <StatCard
          title="SLA Compliance"
          value={`${metrics.slaComplianceRate}%`}
          trend={metrics.slaComplianceTrend}
          trendLabel="vs last period"
          icon={Target}
          iconColor="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {metrics.approvedCount}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
            <Progress 
              value={(metrics.approvedCount / metrics.totalApprovals) * 100} 
              className="mt-3 h-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {metrics.rejectedCount}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-red-500 opacity-50" />
            </div>
            <Progress 
              value={(metrics.rejectedCount / metrics.totalApprovals) * 100} 
              className="mt-3 h-2 [&>div]:bg-red-500"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escalation Rate</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {metrics.escalationRate}%
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
            <div className={cn(
              'flex items-center gap-1 text-sm mt-3',
              metrics.escalationTrend < 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {metrics.escalationTrend < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              <span>{Math.abs(metrics.escalationTrend)}% vs last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProcessingTimeChart data={processingTimeData} />
        <BottleneckAnalysis data={bottleneckData} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TrendChart data={trendData} />
        <ApproverLeaderboard data={approverData} />
      </div>
    </div>
  );
}

// Compact widget version for embedding
interface ApprovalMetricsWidgetProps {
  className?: string;
}

export function ApprovalMetricsWidget({ className }: ApprovalMetricsWidgetProps) {
  const metrics = generateMockMetrics();

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Approval Metrics</CardTitle>
          <Activity size={16} className="text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Pending</span>
          <Badge variant="secondary">{metrics.pendingCount}</Badge>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Approval Rate</span>
          <span className="font-medium text-green-600 dark:text-green-400">{metrics.approvalRate}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Avg Time</span>
          <span className="font-medium">{metrics.averageProcessingTime}h</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">SLA Compliance</span>
          <span className={cn(
            'font-medium',
            metrics.slaComplianceRate >= 90 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
          )}>
            {metrics.slaComplianceRate}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default ApprovalAnalyticsDashboard;

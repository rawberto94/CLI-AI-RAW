'use client';

import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Settings,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SLAMetric {
  id: string;
  name: string;
  description: string;
  category: SLACategory;
  target: number;
  current: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  status: SLAStatus;
  history: SLADataPoint[];
}

interface SLADataPoint {
  date: Date | string;
  value: number;
}

type SLACategory = 
  | 'response-time' 
  | 'uptime' 
  | 'quality' 
  | 'delivery' 
  | 'compliance' 
  | 'support';

type SLAStatus = 'meeting' | 'at-risk' | 'breached';

interface SLAMonitoringProps {
  contractId: string;
  className?: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const mockSLAMetrics: SLAMetric[] = [
  {
    id: 'sla-1',
    name: 'Response Time',
    description: 'Average response time for support tickets',
    category: 'response-time',
    target: 4,
    current: 2.5,
    unit: 'hours',
    trend: 'down',
    trendValue: -15,
    status: 'meeting',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 2 + Math.random() * 2,
    })),
  },
  {
    id: 'sla-2',
    name: 'Service Uptime',
    description: 'Monthly uptime percentage',
    category: 'uptime',
    target: 99.9,
    current: 99.95,
    unit: '%',
    trend: 'up',
    trendValue: 0.05,
    status: 'meeting',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 99.8 + Math.random() * 0.2,
    })),
  },
  {
    id: 'sla-3',
    name: 'Defect Rate',
    description: 'Number of defects per 1000 deliverables',
    category: 'quality',
    target: 5,
    current: 7.2,
    unit: 'per 1000',
    trend: 'up',
    trendValue: 8,
    status: 'at-risk',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 5 + Math.random() * 4,
    })),
  },
  {
    id: 'sla-4',
    name: 'On-Time Delivery',
    description: 'Percentage of deliverables completed on schedule',
    category: 'delivery',
    target: 95,
    current: 92,
    unit: '%',
    trend: 'down',
    trendValue: -3,
    status: 'at-risk',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 88 + Math.random() * 10,
    })),
  },
  {
    id: 'sla-5',
    name: 'Customer Satisfaction',
    description: 'Average CSAT score from surveys',
    category: 'quality',
    target: 4.5,
    current: 4.7,
    unit: '/5',
    trend: 'up',
    trendValue: 5,
    status: 'meeting',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 4.3 + Math.random() * 0.6,
    })),
  },
  {
    id: 'sla-6',
    name: 'Resolution Rate',
    description: 'First-contact resolution percentage',
    category: 'support',
    target: 80,
    current: 75,
    unit: '%',
    trend: 'stable',
    trendValue: 0,
    status: 'at-risk',
    history: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000),
      value: 72 + Math.random() * 8,
    })),
  },
];

// ============================================================================
// Status & Category Configs
// ============================================================================

const statusConfig: Record<SLAStatus, { 
  label: string; 
  color: string; 
  bgColor: string;
  icon: React.ReactNode 
}> = {
  meeting: {
    label: 'Meeting SLA',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: <CheckCircle className="h-4 w-4" />,
  },
  'at-risk': {
    label: 'At Risk',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  breached: {
    label: 'Breached',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: <AlertCircle className="h-4 w-4" />,
  },
};

const categoryConfig: Record<SLACategory, { label: string; color: string }> = {
  'response-time': { label: 'Response Time', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' },
  uptime: { label: 'Uptime', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' },
  quality: { label: 'Quality', color: 'bg-green-100 text-green-700 dark:bg-green-900/30' },
  delivery: { label: 'Delivery', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30' },
  compliance: { label: 'Compliance', color: 'bg-red-100 text-red-700 dark:bg-red-900/30' },
  support: { label: 'Support', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30' },
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateAchievement(metric: SLAMetric): number {
  // For metrics where lower is better (response time, defects)
  const lowerIsBetter = metric.category === 'response-time' || 
    (metric.category === 'quality' && metric.name.toLowerCase().includes('defect'));
  
  if (lowerIsBetter) {
    if (metric.current <= metric.target) return 100;
    return Math.max(0, Math.round((metric.target / metric.current) * 100));
  }
  
  // For metrics where higher is better
  if (metric.current >= metric.target) return 100;
  return Math.round((metric.current / metric.target) * 100);
}

function formatValue(value: number, unit: string): string {
  if (unit === '%') return `${value.toFixed(1)}%`;
  if (unit === '/5') return value.toFixed(1);
  if (unit === 'hours') return `${value.toFixed(1)}h`;
  return `${value.toFixed(1)} ${unit}`;
}

// ============================================================================
// Mini Spark Chart Component
// ============================================================================

function SparkChart({ data }: { data: SLADataPoint[] }) {
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 80;
      const y = 20 - ((v - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width="80" height="24" className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SLAMonitoring({ contractId, className }: SLAMonitoringProps) {
  const [metrics, setMetrics] = useState<SLAMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<SLACategory | 'all'>('all');

  useEffect(() => {
    fetchMetrics();
  }, [contractId]);

  const fetchMetrics = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));
    setMetrics(mockSLAMetrics);
    setLoading(false);
  };

  const filteredMetrics = selectedCategory === 'all' 
    ? metrics 
    : metrics.filter(m => m.category === selectedCategory);

  const meetingSLA = metrics.filter(m => m.status === 'meeting').length;
  const atRisk = metrics.filter(m => m.status === 'at-risk').length;
  const breached = metrics.filter(m => m.status === 'breached').length;
  const overallHealth = metrics.length > 0 
    ? Math.round((meetingSLA / metrics.length) * 100) 
    : 0;

  const categories = Array.from(new Set(metrics.map(m => m.category)));

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              SLA Monitoring
            </CardTitle>
            <CardDescription>
              Track service level agreement compliance and performance
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={fetchMetrics}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              Configure
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{overallHealth}%</span>
            </div>
            <div className="text-sm text-muted-foreground">Overall Health</div>
          </div>
          <div className={cn("rounded-lg p-3 text-center", statusConfig.meeting.bgColor)}>
            <div className="flex items-center justify-center gap-2">
              {statusConfig.meeting.icon}
              <span className={cn("text-2xl font-bold", statusConfig.meeting.color)}>
                {meetingSLA}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">Meeting SLA</div>
          </div>
          <div className={cn("rounded-lg p-3 text-center", statusConfig['at-risk'].bgColor)}>
            <div className="flex items-center justify-center gap-2">
              {statusConfig['at-risk'].icon}
              <span className={cn("text-2xl font-bold", statusConfig['at-risk'].color)}>
                {atRisk}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">At Risk</div>
          </div>
          <div className={cn("rounded-lg p-3 text-center", statusConfig.breached.bgColor)}>
            <div className="flex items-center justify-center gap-2">
              {statusConfig.breached.icon}
              <span className={cn("text-2xl font-bold", statusConfig.breached.color)}>
                {breached}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">Breached</div>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Button>
          {categories.map(cat => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {categoryConfig[cat].label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : metrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Gauge className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No SLA metrics configured</p>
            <p className="text-sm text-muted-foreground mb-4">
              Set up metrics to monitor service level compliance
            </p>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              Configure SLAs
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMetrics.map((metric) => {
              const achievement = calculateAchievement(metric);
              const statusInfo = statusConfig[metric.status];
              
              return (
                <div
                  key={metric.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{metric.name}</span>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", categoryConfig[metric.category].color)}
                        >
                          {categoryConfig[metric.category].label}
                        </Badge>
                        <Badge 
                          variant="secondary"
                          className={cn("text-xs", statusInfo.bgColor, statusInfo.color)}
                        >
                          {statusInfo.icon}
                          <span className="ml-1">{statusInfo.label}</span>
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {metric.description}
                      </p>
                      
                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>
                            Current: <strong>{formatValue(metric.current, metric.unit)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Target: {formatValue(metric.target, metric.unit)}
                          </span>
                        </div>
                        <Progress 
                          value={achievement} 
                          className={cn(
                            "h-2",
                            metric.status === 'breached' && "[&>div]:bg-red-500",
                            metric.status === 'at-risk' && "[&>div]:bg-amber-500",
                            metric.status === 'meeting' && "[&>div]:bg-green-500"
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="ml-6 flex flex-col items-end gap-2">
                      {/* Trend */}
                      <div className={cn(
                        "flex items-center gap-1 text-sm",
                        metric.trend === 'up' && metric.category !== 'response-time' && "text-green-600",
                        metric.trend === 'down' && metric.category !== 'response-time' && "text-red-600",
                        metric.trend === 'up' && metric.category === 'response-time' && "text-red-600",
                        metric.trend === 'down' && metric.category === 'response-time' && "text-green-600",
                        metric.trend === 'stable' && "text-muted-foreground"
                      )}>
                        {metric.trend === 'up' && <TrendingUp className="h-4 w-4" />}
                        {metric.trend === 'down' && <TrendingDown className="h-4 w-4" />}
                        {metric.trend === 'stable' && <BarChart3 className="h-4 w-4" />}
                        {metric.trendValue !== 0 && (
                          <span>{metric.trendValue > 0 ? '+' : ''}{metric.trendValue}%</span>
                        )}
                      </div>
                      
                      {/* Spark Chart */}
                      <SparkChart data={metric.history} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SLAMonitoring;

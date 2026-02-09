'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Activity,
} from 'lucide-react';

interface MetricsChartProps {
  metrics: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    byOwner: Record<string, number>;
    overdueCount: number;
    atRiskCount: number;
    complianceRate: number;
    trends?: {
      completedThisWeek: number;
      completedLastWeek: number;
      createdThisWeek: number;
      createdLastWeek: number;
    };
    timeline?: Array<{
      date: string;
      completed: number;
      created: number;
      overdue: number;
    }>;
  };
  chartType?: 'overview' | 'status' | 'priority' | 'type' | 'timeline' | 'compliance';
  height?: number;
}

// Color schemes
const statusColors: Record<string, string> = {
  pending: '#94a3b8',
  in_progress: '#8b5cf6',
  completed: '#22c55e',
  overdue: '#ef4444',
  at_risk: '#f59e0b',
  waived: '#64748b',
  cancelled: '#6b7280',
};

const priorityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

const typeColors = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899', 
  '#3b82f6', '#f97316', '#14b8a6', '#a855f7', '#64748b',
];

export function ObligationsStatusChart({ metrics, height = 300 }: MetricsChartProps) {
  const data = Object.entries(metrics.byStatus)
    .filter(([_, value]) => value > 0)
    .map(([status, count]) => ({
      name: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
      color: statusColors[status] || '#64748b',
    }));

  const totalActive = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-600" />
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="w-1/2">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value, 'Count']}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 space-y-2">
            {data.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.value}</span>
                  <span className="text-xs text-slate-400">
                    ({Math.round((item.value / totalActive) * 100)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ObligationsPriorityChart({ metrics, height = 250 }: MetricsChartProps) {
  const data = Object.entries(metrics.byPriority)
    .filter(([_, value]) => value > 0)
    .map(([priority, count]) => ({
      name: priority.charAt(0).toUpperCase() + priority.slice(1),
      count,
      fill: priorityColors[priority] || '#64748b',
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          By Priority
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ObligationsTypeChart({ metrics, height = 300 }: MetricsChartProps) {
  const data = Object.entries(metrics.byType)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // Top 8 types
    .map(([type, count], index) => ({
      name: type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      count,
      fill: typeColors[index % typeColors.length],
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-violet-600" />
          By Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ left: 0, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 11 }}
            />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ObligationsTimelineChart({ metrics, height = 300 }: MetricsChartProps) {
  // Generate sample timeline data if not provided
  const timeline = metrics.timeline || generateSampleTimeline();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-600" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={timeline} margin={{ left: 0, right: 20 }}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#22c55e"
              fillOpacity={1}
              fill="url(#colorCompleted)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="created"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorCreated)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="overdue"
              stroke="#ef4444"
              fillOpacity={1}
              fill="url(#colorOverdue)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ComplianceGauge({ complianceRate }: { complianceRate: number }) {
  const rate = Math.round(complianceRate);
  const getColor = (rate: number) => {
    if (rate >= 90) return '#22c55e';
    if (rate >= 70) return '#eab308';
    if (rate >= 50) return '#f97316';
    return '#ef4444';
  };

  const getTrend = (rate: number) => {
    if (rate >= 90) return { icon: TrendingUp, color: 'text-green-600', label: 'Excellent' };
    if (rate >= 70) return { icon: TrendingUp, color: 'text-amber-600', label: 'Good' };
    if (rate >= 50) return { icon: TrendingDown, color: 'text-orange-600', label: 'Needs Attention' };
    return { icon: TrendingDown, color: 'text-red-600', label: 'Critical' };
  };

  const trend = getTrend(rate);
  const TrendIcon = trend.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Compliance Rate
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <svg className="w-32 h-32" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={getColor(rate)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${rate * 2.51} 251`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: getColor(rate) }}>
                {rate}%
              </span>
              <span className="text-xs text-slate-500">Compliance</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <TrendIcon className={`h-4 w-4 ${trend.color}`} />
          <Badge
            variant="secondary"
            className={trend.color}
            style={{ backgroundColor: `${getColor(rate)}20` }}
          >
            {trend.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function ObligationsOwnerChart({ metrics, height = 200 }: MetricsChartProps) {
  const data = Object.entries(metrics.byOwner)
    .filter(([_, value]) => value > 0)
    .map(([owner, count]) => ({
      name: owner === 'us' ? 'Our Obligations' : owner === 'counterparty' ? 'Their Obligations' : 'Shared',
      count,
    }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">By Owner</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={70}
              dataKey="count"
              label={({ name, count }) => `${name}: ${count}`}
            >
              <Cell fill="#8b5cf6" />
              <Cell fill="#06b6d4" />
              <Cell fill="#f59e0b" />
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// Helper to generate sample timeline data
function generateSampleTimeline() {
  const data = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      completed: Math.floor(Math.random() * 5),
      created: Math.floor(Math.random() * 3),
      overdue: Math.floor(Math.random() * 2),
    });
  }
  return data;
}

export function ObligationsChartsGrid({ metrics }: { metrics: MetricsChartProps['metrics'] }) {
  return (
    <div className="space-y-6">
      {/* Top row - Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ComplianceGauge complianceRate={metrics.complianceRate} />
        <ObligationsStatusChart metrics={metrics} height={200} />
        <ObligationsPriorityChart metrics={metrics} height={200} />
      </div>

      {/* Second row - Activity timeline */}
      <ObligationsTimelineChart metrics={metrics} height={250} />

      {/* Third row - Type and Owner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ObligationsTypeChart metrics={metrics} height={280} />
        <ObligationsOwnerChart metrics={metrics} height={280} />
      </div>
    </div>
  );
}

export default ObligationsChartsGrid;

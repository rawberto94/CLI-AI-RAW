/**
 * Enhanced Interactive Charts
 * Animated, interactive charts with tooltips and drill-down
 */

'use client';

import React, { useState } from 'react';
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
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  AlertCircle,
  ChevronRight,
  Maximize2
} from 'lucide-react';

// Color palette for charts
const COLORS = {
  primary: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  success: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  warning: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a'],
  error: ['#ef4444', '#f87171', '#fca5a5', '#fecaca'],
  purple: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  gradient: ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']
};

interface TrendChartProps {
  data: Array<{
    date: string;
    value: number;
    previousValue?: number;
  }>;
  title: string;
  description?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  showComparison?: boolean;
  height?: number;
  className?: string;
}

export function TrendChart({
  data,
  title,
  description,
  valuePrefix = '',
  valueSuffix = '',
  showComparison = false,
  height = 300,
  className
}: TrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const currentValue = data[data.length - 1]?.value || 0;
  const previousValue = data[0]?.value || 0;
  const change = previousValue ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = change >= 0;

  const formatValue = (val: number) => {
    if (valuePrefix === '$') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(val);
    }
    return `${valuePrefix}${val.toLocaleString()}${valueSuffix}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3"
        >
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {formatValue(payload[0].value)}
          </p>
          {showComparison && payload[1] && (
            <p className="text-sm text-gray-500 mt-1">
              vs {formatValue(payload[1].value)}
            </p>
          )}
        </motion.div>
      );
    }
    return null;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{formatValue(currentValue)}</p>
            <Badge
              className={cn(
                'mt-1',
                isPositive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
              )}
            >
              {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {Math.abs(change).toFixed(1)}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              {showComparison && (
                <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#9ca3af" stopOpacity={0} />
                </linearGradient>
              )}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => formatValue(value)}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            {showComparison && (
              <Area
                type="monotone"
                dataKey="previousValue"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorPrevious)"
              />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Distribution Chart with animated segments
 */
interface DistributionChartProps {
  data: Array<{
    name: string;
    value: number;
    color?: string;
  }>;
  title: string;
  description?: string;
  height?: number;
  className?: string;
  onSegmentClick?: (segment: { name: string; value: number }) => void;
}

export function DistributionChart({
  data,
  title,
  description,
  height = 300,
  className,
  onSegmentClick
}: DistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const colors = COLORS.gradient;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = ((data.value / total) * 100).toFixed(1);
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{data.name}</p>
          <p className="text-lg font-bold mt-1">{data.value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{percentage}% of total</p>
        </motion.div>
      );
    }
    return null;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={(data) => onSegmentClick?.(data)}
                  cursor={onSegmentClick ? 'pointer' : 'default'}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || colors[index % colors.length]}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                      stroke={activeIndex === index ? '#fff' : 'none'}
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="space-y-2 min-w-[120px]">
            {data.map((item, index) => (
              <motion.div
                key={item.name}
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                  activeIndex === index && 'bg-gray-100 dark:bg-gray-800',
                  onSegmentClick && 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => onSegmentClick?.(item)}
              >
                <div
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color || colors[index % colors.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.value.toLocaleString()} ({((item.value / total) * 100).toFixed(0)}%)
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Risk Distribution Chart
 */
interface RiskChartProps {
  data: Array<{
    category: string;
    low: number;
    medium: number;
    high: number;
  }>;
  title: string;
  description?: string;
  height?: number;
  className?: string;
}

export function RiskDistributionChart({
  data,
  title,
  description,
  height = 300,
  className
}: RiskChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3"
        >
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600 dark:text-gray-400">{entry.name}:</span>
              <span className="font-medium">{entry.value}</span>
            </div>
          ))}
        </motion.div>
      );
    }
    return null;
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {title}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="low"
              name="Low Risk"
              stackId="a"
              fill={COLORS.success[0]}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="medium"
              name="Medium Risk"
              stackId="a"
              fill={COLORS.warning[0]}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="high"
              name="High Risk"
              stackId="a"
              fill={COLORS.error[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Comparison Bar Chart
 */
interface ComparisonChartProps {
  data: Array<{
    name: string;
    current: number;
    previous: number;
  }>;
  title: string;
  description?: string;
  height?: number;
  className?: string;
}

export function ComparisonChart({
  data,
  title,
  description,
  height = 300,
  className
}: ComparisonChartProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 8
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="previous" name="Previous" fill={COLORS.primary[2]} radius={4} barSize={16} />
            <Bar dataKey="current" name="Current" fill={COLORS.primary[0]} radius={4} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Mini Sparkline for compact display
 */
interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDot?: boolean;
}

export function Sparkline({
  data,
  color = '#3b82f6',
  height = 32,
  width = 100,
  showDot = true
}: SparklineProps) {
  const chartData = data.map((value, index) => ({ value, index }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={showDot ? { r: 0 } : false}
          activeDot={showDot ? { r: 4, fill: color } : false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default TrendChart;

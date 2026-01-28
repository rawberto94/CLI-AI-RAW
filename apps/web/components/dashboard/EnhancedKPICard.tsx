/**
 * Enhanced KPI Card Component
 * Features: Animated counters, sparklines, trend indicators, micro-animations
 */

'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface SparklineData {
  value: number;
  label?: string;
}

export interface EnhancedKPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBgColor?: string;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  trendLabel?: string;
  sparklineData?: SparklineData[];
  sparklineColor?: string;
  href?: string;
  linkText?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isUrgent?: boolean;
  className?: string;
}

const variantStyles = {
  default: {
    border: 'border-gray-200 dark:border-gray-800',
    iconBg: 'bg-violet-50 dark:bg-violet-950',
    iconColor: 'text-violet-600 dark:text-violet-400',
    sparkline: '#7C3AED',
    hoverBg: 'group-hover:bg-violet-50 dark:group-hover:bg-violet-950/50',
  },
  success: {
    border: 'border-green-200 dark:border-green-800',
    iconBg: 'bg-green-50 dark:bg-green-950',
    iconColor: 'text-green-600 dark:text-green-400',
    sparkline: '#10B981',
    hoverBg: 'group-hover:bg-green-50 dark:group-hover:bg-green-950/50',
  },
  warning: {
    border: 'border-orange-200 dark:border-orange-800',
    iconBg: 'bg-orange-50 dark:bg-orange-950',
    iconColor: 'text-orange-600 dark:text-orange-400',
    sparkline: '#F59E0B',
    hoverBg: 'group-hover:bg-orange-50 dark:group-hover:bg-orange-950/50',
  },
  danger: {
    border: 'border-red-200 dark:border-red-800',
    iconBg: 'bg-red-50 dark:bg-red-950',
    iconColor: 'text-red-600 dark:text-red-400',
    sparkline: '#EF4444',
    hoverBg: 'group-hover:bg-red-50 dark:group-hover:bg-red-950/50',
  },
  info: {
    border: 'border-purple-200 dark:border-purple-800',
    iconBg: 'bg-purple-50 dark:bg-purple-950',
    iconColor: 'text-purple-600 dark:text-purple-400',
    sparkline: '#8B5CF6',
    hoverBg: 'group-hover:bg-purple-50 dark:group-hover:bg-purple-950/50',
  },
};

export function EnhancedKPICard({
  title,
  value,
  previousValue,
  prefix = '',
  suffix = '',
  decimals = 0,
  icon,
  iconColor,
  iconBgColor,
  description,
  trend,
  trendValue,
  trendLabel,
  sparklineData,
  sparklineColor,
  href,
  linkText,
  variant = 'default',
  isUrgent = false,
  className,
}: EnhancedKPICardProps) {
  const styles = variantStyles[variant];
  
  // Calculate trend from previous value if not provided
  const calculatedTrend = useMemo(() => {
    if (trend) return trend;
    if (previousValue === undefined) return 'neutral';
    if (value > previousValue) return 'up';
    if (value < previousValue) return 'down';
    return 'neutral';
  }, [trend, value, previousValue]);

  const calculatedTrendValue = useMemo(() => {
    if (trendValue !== undefined) return trendValue;
    if (previousValue === undefined || previousValue === 0) return 0;
    return Math.round(((value - previousValue) / previousValue) * 100);
  }, [trendValue, value, previousValue]);

  const TrendIcon = calculatedTrend === 'up' 
    ? TrendingUp 
    : calculatedTrend === 'down' 
      ? TrendingDown 
      : Minus;

  const trendColorClass = calculatedTrend === 'up'
    ? 'text-green-600 dark:text-green-400'
    : calculatedTrend === 'down'
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={className}
    >
      <Card 
        className={cn(
          'group relative overflow-hidden transition-all duration-300',
          'bg-white dark:bg-gray-900 rounded-xl border shadow-sm',
          'hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700',
          styles.border,
          isUrgent && 'ring-2 ring-red-500 ring-offset-2'
        )}
      >
        {/* Urgent Pulse Animation */}
        {isUrgent && (
          <motion.div
            className="absolute inset-0 bg-red-500/10"
            animate={{ opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <motion.div 
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-lg',
                iconBgColor || styles.iconBg,
                iconColor || styles.iconColor
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {icon}
            </motion.div>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Main Value with Animation */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              <CountUp
                to={value}
                duration={1.5}
                decimals={decimals}
                prefix={prefix}
                suffix={suffix}
              />
            </span>
          </div>

          {/* Trend Indicator */}
          {(calculatedTrendValue !== 0 || trendLabel) && (
            <div className="flex items-center gap-2">
              <div className={cn('flex items-center gap-1 text-sm', trendColorClass)}>
                <TrendIcon className="h-4 w-4" />
                <span className="font-medium">
                  {calculatedTrendValue > 0 ? '+' : ''}{calculatedTrendValue}%
                </span>
              </div>
              {trendLabel && (
                <span className="text-sm text-muted-foreground">{trendLabel}</span>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}

          {/* Sparkline Chart */}
          {sparklineData && sparklineData.length > 0 && (
            <div className="h-12 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparklineData}>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const firstPayload = payload[0];
                        if (!firstPayload) return null;
                        return (
                          <div className="bg-white dark:bg-gray-800 border rounded-lg px-2 py-1 shadow-lg text-xs">
                            {firstPayload.payload.label && (
                              <p className="text-muted-foreground">{firstPayload.payload.label}</p>
                            )}
                            <p className="font-semibold">{prefix}{firstPayload.value}{suffix}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={sparklineColor || styles.sparkline}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: sparklineColor || styles.sparkline }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Link */}
          {href && linkText && (
            <motion.a
              href={href}
              className={cn(
                'flex items-center justify-center gap-1 text-xs font-medium',
                'py-2 px-3 rounded-lg transition-colors mt-2',
                'text-gray-600 dark:text-gray-400',
                styles.hoverBg
              )}
              whileHover={{ x: 4 }}
            >
              {linkText}
              <ArrowUpRight className="h-3 w-3" />
            </motion.a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Mini Sparkline Component for inline use
 */
export function MiniSparkline({
  data,
  color = '#7C3AED',
  height = 24,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  return (
    <div className={cn('w-20', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Trend Badge Component
 */
export function TrendBadge({
  value,
  label,
  showIcon = true,
  size = 'default',
}: {
  value: number;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <div 
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
        isNeutral 
          ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          : isPositive
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      )}
    >
      {showIcon && (
        isNeutral ? (
          <Minus className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        ) : isPositive ? (
          <ArrowUpRight className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        ) : (
          <ArrowDownRight className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        )
      )}
      <span>{isPositive ? '+' : ''}{value}%</span>
      {label && <span className="text-muted-foreground ml-1">{label}</span>}
    </div>
  );
}

export default EnhancedKPICard;

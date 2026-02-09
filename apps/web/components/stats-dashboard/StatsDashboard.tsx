'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, TrendingUp, TrendingDown, Minus, RefreshCw,
  Activity, DollarSign, Users, Eye, ShoppingCart, 
  ArrowUp, ArrowDown, MoreHorizontal, ExternalLink, Info
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface StatValue {
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  label: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';
  format?: 'number' | 'currency' | 'percent' | 'compact';
  prefix?: string;
  suffix?: string;
  href?: string;
  onClick?: () => void;
}

// ============================================================================
// Formatters
// ============================================================================

function formatValue(value: number | string, format?: string, prefix?: string, suffix?: string): string {
  if (typeof value === 'string') return `${prefix || ''}${value}${suffix || ''}`;
  
  let formatted: string;
  switch (format) {
    case 'currency':
      formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
      break;
    case 'percent':
      formatted = `${value.toFixed(1)}%`;
      break;
    case 'compact':
      formatted = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
      break;
    default:
      formatted = new Intl.NumberFormat('en-US').format(value);
  }
  
  return `${prefix || ''}${formatted}${suffix || ''}`;
}

// ============================================================================
// Stat Card
// ============================================================================

interface StatCardProps extends StatValue {
  loading?: boolean;
  className?: string;
}

export function StatCard({
  value,
  previousValue,
  change,
  changeType,
  label,
  icon,
  color = 'blue',
  format,
  prefix,
  suffix,
  href,
  onClick,
  loading = false,
  className = '',
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400',
    green: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400',
    gray: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  };

  const changeColors = {
    increase: 'text-green-600 dark:text-green-400',
    decrease: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-500 dark:text-gray-400',
  };

  const ChangeIcon = changeType === 'increase' ? TrendingUp 
    : changeType === 'decrease' ? TrendingDown 
    : Minus;

  const Wrapper = href ? 'a' : onClick ? 'button' : 'div';
  const wrapperProps = href ? { href } : onClick ? { onClick } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`
        block bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800
        ${(href || onClick) ? 'hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-200 dark:hover:border-violet-700 transition-all cursor-pointer' : ''}
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          {icon || <Activity className="w-5 h-5" />}
        </div>
        {(href || onClick) && (
          <ExternalLink className="w-4 h-4 text-gray-400" />
        )}
      </div>

      {loading ? (
        <>
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-gray-900 dark:text-white mb-1"
          >
            {formatValue(value, format, prefix, suffix)}
          </motion.div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
            {change !== undefined && (
              <span className={`flex items-center text-sm ${changeColors[changeType || 'neutral']}`}>
                <ChangeIcon className="w-4 h-4 mr-0.5" />
                {Math.abs(change)}%
              </span>
            )}
          </div>
        </>
      )}
    </Wrapper>
  );
}

// ============================================================================
// Stat Row (Compact)
// ============================================================================

export function StatRow({
  value,
  change,
  changeType,
  label,
  icon,
  format,
  prefix,
  suffix,
  className = '',
}: StatCardProps) {
  const changeColors = {
    increase: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950',
    decrease: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950',
    neutral: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
  };

  return (
    <div className={`flex items-center justify-between py-3 ${className}`}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-gray-400">{icon}</div>}
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatValue(value, format, prefix, suffix)}
        </span>
        {change !== undefined && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${changeColors[changeType || 'neutral']}`}>
            {changeType === 'increase' ? '+' : changeType === 'decrease' ? '' : ''}{change}%
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Stats Grid
// ============================================================================

interface StatsGridProps {
  stats: StatValue[];
  columns?: 2 | 3 | 4 | 5;
  loading?: boolean;
  className?: string;
}

export function StatsGrid({
  stats,
  columns = 4,
  loading = false,
  className = '',
}: StatsGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  };

  return (
    <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} loading={loading} />
      ))}
    </div>
  );
}

// ============================================================================
// Live Counter
// ============================================================================

interface LiveCounterProps {
  value: number;
  label: string;
  icon?: React.ReactNode;
  refreshInterval?: number;
  onRefresh?: () => Promise<number>;
  format?: 'number' | 'currency' | 'compact';
  className?: string;
}

export function LiveCounter({
  value: initialValue,
  label,
  icon,
  refreshInterval = 5000,
  onRefresh,
  format = 'number',
  className = '',
}: LiveCounterProps) {
  const [value, setValue] = useState(initialValue);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!onRefresh || refreshInterval <= 0) return;

    const refresh = async () => {
      setIsRefreshing(true);
      try {
        const newValue = await onRefresh();
        setValue(newValue);
        setLastUpdated(new Date());
      } finally {
        setIsRefreshing(false);
      }
    };

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [onRefresh, refreshInterval]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          {icon}
          <span className="text-sm">{label}</span>
        </div>
        <motion.div
          animate={{ rotate: isRefreshing ? 360 : 0 }}
          transition={{ duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' }}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'text-violet-500' : 'text-gray-400'}`} />
        </motion.div>
      </div>
      
      <motion.div
        key={value}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-gray-900 dark:text-white"
      >
        {formatValue(value, format)}
      </motion.div>

      <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
        <Clock className="w-3 h-3" />
        <span>Updated {lastUpdated.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Comparison Stat
// ============================================================================

interface ComparisonStatProps {
  current: { value: number; label: string };
  previous: { value: number; label: string };
  format?: 'number' | 'currency' | 'percent' | 'compact';
  className?: string;
}

export function ComparisonStat({
  current,
  previous,
  format = 'number',
  className = '',
}: ComparisonStatProps) {
  const change = previous.value !== 0 
    ? ((current.value - previous.value) / previous.value) * 100 
    : 0;
  const isIncrease = change > 0;
  const isDecrease = change < 0;

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {current.label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatValue(current.value, format)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {previous.label}
          </p>
          <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
            {formatValue(previous.value, format)}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 ${
            isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-500'
          }`}>
            {isIncrease ? <ArrowUp className="w-4 h-4" /> : isDecrease ? <ArrowDown className="w-4 h-4" /> : null}
            <span className="font-semibold">{Math.abs(change).toFixed(1)}%</span>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isIncrease ? 'increase' : isDecrease ? 'decrease' : 'no change'} from {previous.label.toLowerCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Mini Stats
// ============================================================================

interface MiniStatProps {
  value: number | string;
  label: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MiniStat({
  value,
  label,
  icon,
  trend,
  className = '',
}: MiniStatProps) {
  const trendColors = {
    up: 'text-green-500',
    down: 'text-red-500',
    neutral: 'text-gray-400',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon && (
        <div className={trend ? trendColors[trend] : 'text-gray-400'}>
          {icon}
        </div>
      )}
      <div>
        <div className="font-semibold text-gray-900 dark:text-white">
          {typeof value === 'number' ? formatValue(value, 'compact') : value}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      </div>
    </div>
  );
}

// ============================================================================
// Stat with Sparkline
// ============================================================================

interface StatWithSparklineProps extends StatValue {
  data: number[];
  className?: string;
}

export function StatWithSparkline({
  value,
  change,
  changeType,
  label,
  data,
  format,
  prefix,
  suffix,
  className = '',
}: StatWithSparklineProps) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  const lineColor = changeType === 'increase' 
    ? '#10B981' 
    : changeType === 'decrease' 
    ? '#EF4444' 
    : '#6B7280';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatValue(value, format, prefix, suffix)}
            </span>
            {change !== undefined && (
              <span className={`text-sm ${
                changeType === 'increase' ? 'text-green-600' : 
                changeType === 'decrease' ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {changeType === 'increase' ? '+' : ''}{change}%
              </span>
            )}
          </div>
        </div>
        
        <svg viewBox="0 0 100 40" className="w-24 h-10">
          <polyline
            fill="none"
            stroke={lineColor}
            strokeWidth="2"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}

'use client';

/**
 * Sparkline Charts
 * Minimal inline charts for quick data visualization
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  showArea?: boolean;
  animate?: boolean;
  className?: string;
}

// ============================================================================
// Base Sparkline
// ============================================================================

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = '#6366f1',
  fillColor,
  strokeWidth = 2,
  showArea = true,
  animate = true,
  className,
}: SparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((value - min) / range) * (height - padding * 2) - padding;
      return { x, y };
    });

    // Create smooth curve using quadratic bezier
    let d = `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (!prev || !curr) continue;
      const midX = (prev.x + curr.x) / 2;
      d += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`;
    }
    
    const lastPoint = points[points.length - 1];
    if (lastPoint) {
      d += ` T ${lastPoint.x} ${lastPoint.y}`;
    }
    
    return d;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (!showArea || data.length < 2) return '';
    const lastPoint = data.length - 1;
    const padding = 2;
    return `${path} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  }, [path, showArea, data.length, width, height]);

  if (data.length < 2) {
    return <div className={cn('w-full h-8', className)} />;
  }

  return (
    <svg 
      width={width} 
      height={height} 
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Area fill */}
      {showArea && (
        <motion.path
          d={areaPath}
          fill={fillColor || `${color}20`}
          initial={animate ? { opacity: 0 } : undefined}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
      
      {/* Line */}
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animate ? { pathLength: 0 } : undefined}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      
      {/* End dot */}
      {data.length > 0 && (
        <motion.circle
          cx={width - 2}
          cy={height - ((data[data.length - 1]! - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * (height - 4) - 2}
          r={3}
          fill={color}
          initial={animate ? { scale: 0 } : undefined}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring' }}
        />
      )}
    </svg>
  );
}

// ============================================================================
// Bar Sparkline
// ============================================================================

interface BarSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  negativeColor?: string;
  gap?: number;
  animate?: boolean;
  className?: string;
}

export function BarSparkline({
  data,
  width = 100,
  height = 32,
  color = '#6366f1',
  negativeColor = '#ef4444',
  gap = 2,
  animate = true,
  className,
}: BarSparklineProps) {
  const bars = useMemo(() => {
    if (data.length === 0) return [];
    
    const max = Math.max(...data.map(Math.abs));
    const barWidth = (width - (data.length - 1) * gap) / data.length;
    const midY = height / 2;
    
    return data.map((value, index) => {
      const barHeight = max === 0 ? 0 : (Math.abs(value) / max) * (height / 2 - 2);
      const x = index * (barWidth + gap);
      const y = value >= 0 ? midY - barHeight : midY;
      
      return {
        x,
        y,
        width: barWidth,
        height: barHeight,
        isPositive: value >= 0,
      };
    });
  }, [data, width, height, gap]);

  return (
    <svg width={width} height={height} className={className}>
      {/* Zero line */}
      <line
        x1={0}
        y1={height / 2}
        x2={width}
        y2={height / 2}
        stroke="#e2e8f0"
        strokeWidth={1}
      />
      
      {/* Bars */}
      {bars.map((bar, index) => (
        <motion.rect
          key={index}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx={2}
          fill={bar.isPositive ? color : negativeColor}
          initial={animate ? { scaleY: 0 } : undefined}
          animate={{ scaleY: 1 }}
          transition={{ delay: index * 0.03, duration: 0.3 }}
          style={{ transformOrigin: bar.isPositive ? 'bottom' : 'top' }}
        />
      ))}
    </svg>
  );
}

// ============================================================================
// Stat with Sparkline
// ============================================================================

interface StatSparklineProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  data: number[];
  color?: string;
  className?: string;
}

export function StatSparkline({
  label,
  value,
  change,
  changeLabel,
  data,
  color,
  className,
}: StatSparklineProps) {
  const trend = change !== undefined ? (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') : 'neutral';
  
  const trendColors = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-slate-500 bg-slate-50',
  };

  const sparklineColor = color || (trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6366f1');

  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 p-4', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
          
          {change !== undefined && (
            <div className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2',
              trendColors[trend]
            )}>
              {trend === 'up' ? (
                <TrendingUp className="w-3 h-3" />
              ) : trend === 'down' ? (
                <TrendingDown className="w-3 h-3" />
              ) : (
                <Minus className="w-3 h-3" />
              )}
              {Math.abs(change)}%
              {changeLabel && <span className="text-slate-400 ml-1">{changeLabel}</span>}
            </div>
          )}
        </div>
        
        <Sparkline
          data={data}
          width={80}
          height={40}
          color={sparklineColor}
          className="flex-shrink-0"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Mini Gauge
// ============================================================================

interface MiniGaugeProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  showValue?: boolean;
  label?: string;
  className?: string;
}

export function MiniGauge({
  value,
  max = 100,
  size = 48,
  strokeWidth = 4,
  color = '#6366f1',
  bgColor = '#e2e8f0',
  showValue = true,
  label,
  className,
}: MiniGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={bgColor}
            strokeWidth={strokeWidth}
          />
          
          {/* Progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-slate-700">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>
      
      {label && (
        <span className="text-xs text-slate-500 mt-1">{label}</span>
      )}
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

interface MiniProgressProps {
  value: number;
  max?: number;
  color?: string;
  bgColor?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function MiniProgress({
  value,
  max = 100,
  color = '#6366f1',
  bgColor = '#e2e8f0',
  size = 'md',
  showLabel = false,
  className,
}: MiniProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('w-full', className)}>
      <div 
        className={cn('w-full rounded-full overflow-hidden', sizes[size])}
        style={{ backgroundColor: bgColor }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      
      {showLabel && (
        <p className="text-xs text-slate-500 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}

// ============================================================================
// Trend Badge
// ============================================================================

interface TrendBadgeProps {
  value: number;
  suffix?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function TrendBadge({
  value,
  suffix = '%',
  size = 'md',
  className,
}: TrendBadgeProps) {
  const trend = value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
  
  const colors = {
    up: 'text-green-700 bg-green-100',
    down: 'text-red-700 bg-red-100',
    neutral: 'text-slate-600 bg-slate-100',
  };

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-sm px-2 py-1 gap-1',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  };

  return (
    <span className={cn(
      'inline-flex items-center font-medium rounded-full',
      colors[trend],
      sizes[size],
      className
    )}>
      {trend === 'up' ? (
        <TrendingUp className={iconSizes[size]} />
      ) : trend === 'down' ? (
        <TrendingDown className={iconSizes[size]} />
      ) : (
        <Minus className={iconSizes[size]} />
      )}
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );
}

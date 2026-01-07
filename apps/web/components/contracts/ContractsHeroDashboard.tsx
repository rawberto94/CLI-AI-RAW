/**
 * Contracts Hero Dashboard
 * A visually striking stats dashboard header for the contracts page
 * v2.1 - Added animated counters and live data indicators
 */

'use client';

import React, { useMemo, memo, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  DollarSign,
  Shield,
  CheckCircle,
  Upload,
  Sparkles,
  GitCompare,
  ArrowUpRight,
  Activity,
  Target,
  Zap,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  monthlyChange?: number;
  expiringSoon: number;
  expiringThisWeek?: number;
  highRisk?: number;
  highRiskContracts?: number;
  riskTrend?: 'up' | 'down' | 'stable' | string;
  processingCount?: number;
  pendingReview: number;
  recentlyAdded: number;
  avgRiskScore?: number;
  trends?: {
    contracts: number; // percentage change
    value: number;
    risk: number;
  };
  trendData?: Array<{
    date: string;
    contracts: number;
    value: number;
  }>;
}

export interface ContractsHeroDashboardProps {
  stats: ContractStats;
  isLoading?: boolean;
  onUploadClick?: () => void;
  onGenerateClick?: () => void;
  onCompareClick?: () => void;
  onAskAIClick?: () => void;
  onQuickAction?: (action: string) => void;
  className?: string;
}

// ============================================================================
// Mini Sparkline Component
// ============================================================================

function Sparkline({ 
  data, 
  color = 'blue',
  height = 32,
  className = ''
}: { 
  data: number[];
  color?: 'blue' | 'green' | 'red' | 'amber';
  height?: number;
  className?: string;
}) {
  const colorClasses = {
    blue: 'stroke-blue-500',
    green: 'stroke-emerald-500',
    red: 'stroke-red-500',
    amber: 'stroke-amber-500',
  };

  const fillClasses = {
    blue: 'fill-blue-500/10',
    green: 'fill-emerald-500/10',
    red: 'fill-red-500/10',
    amber: 'fill-amber-500/10',
  };

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg 
      className={className} 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
    >
      <polygon 
        points={areaPoints} 
        className={fillClasses[color]}
      />
      <polyline
        points={points}
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={colorClasses[color]}
      />
    </svg>
  );
}

// ============================================================================
// Animated Counter Component
// ============================================================================

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
  formatFn?: (value: number) => string;
}

const AnimatedCounter = memo(function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  className = '',
  duration = 600,
  formatFn
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (previousValue.current === value) return;
    
    setIsAnimating(true);
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(startValue + (endValue - startValue) * easeOutQuart);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
    previousValue.current = value;
  }, [value, duration]);
  
  const formattedValue = formatFn ? formatFn(displayValue) : displayValue.toLocaleString();
  
  return (
    <span className={cn(className, isAnimating && 'text-blue-400 transition-colors duration-300')}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
});

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
  sparklineData?: number[];
  delay?: number;
  onClick?: () => void;
}

const StatCard = memo(function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color,
  sparklineData,
  delay = 0,
  onClick,
}: StatCardProps) {
  const colorStyles = {
    blue: {
      bg: 'bg-gradient-to-br from-blue-500 to-blue-600',
      light: 'bg-blue-50',
      text: 'text-blue-600',
      ring: 'ring-blue-500/20',
    },
    green: {
      bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      light: 'bg-emerald-50',
      text: 'text-emerald-600',
      ring: 'ring-emerald-500/20',
    },
    amber: {
      bg: 'bg-gradient-to-br from-amber-500 to-amber-600',
      light: 'bg-amber-50',
      text: 'text-amber-600',
      ring: 'ring-amber-500/20',
    },
    red: {
      bg: 'bg-gradient-to-br from-red-500 to-red-600',
      light: 'bg-red-50',
      text: 'text-red-600',
      ring: 'ring-red-500/20',
    },
    purple: {
      bg: 'bg-gradient-to-br from-purple-500 to-purple-600',
      light: 'bg-purple-50',
      text: 'text-purple-600',
      ring: 'ring-purple-500/20',
    },
    cyan: {
      bg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
      light: 'bg-cyan-50',
      text: 'text-cyan-600',
      ring: 'ring-cyan-500/20',
    },
  };

  const styles = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white p-5 shadow-lg shadow-slate-200/50",
        "border border-slate-100 hover:border-slate-200 transition-all duration-300",
        "hover:shadow-xl hover:shadow-slate-300/50",
        onClick && "cursor-pointer"
      )}
    >
      {/* Background Pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03]">
        <Icon className="w-full h-full" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={cn("p-2.5 rounded-xl shadow-lg", styles.bg)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {trend !== undefined && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trend >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
            )}>
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight">
            {value}
          </h3>
        </div>

        {/* Title & Subtitle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">{title}</p>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
          {sparklineData && (
            <Sparkline 
              data={sparklineData} 
              color={trend && trend >= 0 ? 'green' : trend && trend < 0 ? 'red' : 'blue'}
            />
          )}
        </div>

        {/* Click Indicator */}
        {onClick && (
          <div className={cn(
            "absolute bottom-3 right-3 p-1.5 rounded-lg transition-colors",
            styles.light
          )}>
            <ArrowUpRight className={cn("h-3.5 w-3.5", styles.text)} />
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// Alert Card Component
// ============================================================================

interface AlertCardProps {
  title: string;
  count: number;
  icon: React.ElementType;
  color: 'amber' | 'red';
  description: string;
  onClick?: () => void;
}

const AlertCard = memo(function AlertCard({
  title,
  count,
  icon: Icon,
  color,
  description,
  onClick,
}: AlertCardProps) {
  const colorStyles = {
    amber: {
      bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
      border: 'border-amber-200',
      icon: 'bg-amber-100 text-amber-600',
      text: 'text-amber-700',
    },
    red: {
      bg: 'bg-gradient-to-r from-red-50 to-rose-50',
      border: 'border-red-200',
      icon: 'bg-red-100 text-red-600',
      text: 'text-red-700',
    },
  };

  const styles = colorStyles[color];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border transition-all",
        styles.bg,
        styles.border,
        onClick && "cursor-pointer hover:shadow-md"
      )}
    >
      <div className={cn("p-2 rounded-lg", styles.icon)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-lg font-bold", styles.text)}>{count}</span>
          <span className="text-sm font-medium text-slate-700">{title}</span>
        </div>
        <p className="text-xs text-slate-500 truncate">{description}</p>
      </div>
      {onClick && (
        <ArrowUpRight className={cn("h-4 w-4", styles.text)} />
      )}
    </motion.div>
  );
});

// ============================================================================
// Quick Action Button Component
// ============================================================================

interface QuickActionProps {
  label: string;
  icon: React.ElementType;
  color: 'blue' | 'purple' | 'cyan';
  onClick?: () => void;
  href?: string;
}

const QuickAction = memo(function QuickAction({
  label,
  icon: Icon,
  color,
  onClick,
  href,
}: QuickActionProps) {
  const colorStyles = {
    blue: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25',
    purple: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25',
    cyan: 'bg-cyan-600 hover:bg-cyan-700 shadow-cyan-500/25',
  };

  const content = (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Button
        onClick={onClick}
        className={cn(
          "h-11 px-5 rounded-xl font-medium shadow-lg transition-all",
          colorStyles[color],
          "text-white"
        )}
      >
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
});

// ============================================================================
// Main Dashboard Component
// ============================================================================

export const ContractsHeroDashboard = memo(function ContractsHeroDashboard({
  stats,
  isLoading = false,
  onUploadClick,
  onGenerateClick,
  onCompareClick,
  onAskAIClick,
}: ContractsHeroDashboardProps) {
  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  // Generate sample sparkline data
  const generateSparkline = (trend: number): number[] => {
    const base = 50;
    const data = [];
    for (let i = 0; i < 7; i++) {
      const variance = (Math.random() - 0.5) * 20;
      const trendValue = (trend / 100) * i * 5;
      data.push(base + variance + trendValue);
    }
    return data;
  };

  const sparklines = useMemo(() => ({
    contracts: generateSparkline(stats.trends?.contracts ?? 0),
    value: generateSparkline(stats.trends?.value ?? 0),
    risk: generateSparkline(-(stats.trends?.risk ?? 0)),
  }), [stats.trends]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Animated skeleton loader */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-8 w-48 bg-slate-200 rounded-lg" />
                <div className="h-4 w-32 bg-slate-200 rounded-md" />
              </div>
              <div className="flex gap-3">
                <div className="h-11 w-28 bg-slate-200 rounded-xl" />
                <div className="h-11 w-28 bg-slate-200 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-44 bg-slate-200/80 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Premium Hero Section with gradient background */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-4"
      >
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.1),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(74,144,226,0.1),transparent_50%)]" />
          </div>
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
        </div>

        {/* Header with Quick Actions */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <h1 className="text-lg md:text-xl font-bold text-white">
                Contract Portfolio
              </h1>
            </div>
            <p className="text-slate-300 text-xs md:text-sm">,
              Real-time overview of your {stats.totalContracts?.toLocaleString() || 0} contracts worth {formatCurrency(stats.totalValue ?? 0)}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex items-center gap-2 md:gap-3"
          >
            <Link href="/contracts/upload">
              <Button 
                onClick={onUploadClick}
                className="h-10 md:h-11 px-4 md:px-5 rounded-xl font-medium bg-white text-slate-900 hover:bg-slate-100 shadow-lg shadow-black/20 transition-all hover:shadow-xl hover:scale-[1.02]"
              >
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            </Link>
            <Link href="/contracts/generate">
              <Button 
                onClick={onGenerateClick}
                className="h-10 md:h-11 px-4 md:px-5 rounded-xl font-medium bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:scale-[1.02]"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Generate</span>
              </Button>
            </Link>
            <Button 
              onClick={onAskAIClick}
              className="h-10 md:h-11 px-4 md:px-5 rounded-xl font-medium bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg shadow-cyan-500/25 transition-all hover:shadow-xl hover:scale-[1.02]"
            >
              <Target className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ask AI</span>
            </Button>
          </motion.div>
        </div>

        {/* Stats Cards - Inside Hero */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {/* Total Contracts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="group relative overflow-hidden rounded-lg bg-white/10 backdrop-blur-md border border-white/10 p-2.5 md:p-3 hover:bg-white/15 transition-all cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
              <FileText className="w-full h-full text-white" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-blue-500/20 backdrop-blur-sm">
                <FileText className="h-4 w-4 text-blue-300" />
              </div>
              {(stats.trends?.contracts ?? 0) !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm",
                  (stats.trends?.contracts ?? 0) >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                )}>
                  {(stats.trends?.contracts ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stats.trends?.contracts ?? 0)}%
                </div>
              )}
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              <AnimatedCounter value={stats.totalContracts ?? 0} />
            </h3>
            <p className="text-sm text-slate-300 mt-1">Total Contracts</p>
            <p className="text-xs text-slate-400">{stats.activeContracts ?? 0} active</p>
            {sparklines.contracts.length > 0 && (
              <div className="absolute bottom-3 right-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={sparklines.contracts} color="blue" height={24} />
              </div>
            )}
          </motion.div>

          {/* Total Value */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 md:p-5 hover:bg-white/15 transition-all cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
              <DollarSign className="w-full h-full text-white" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/20 backdrop-blur-sm">
                <DollarSign className="h-4 w-4 text-emerald-300" />
              </div>
              {(stats.trends?.value ?? 0) !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full backdrop-blur-sm",
                  (stats.trends?.value ?? 0) >= 0 ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
                )}>
                  {(stats.trends?.value ?? 0) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(stats.trends?.value ?? 0)}%
                </div>
              )}
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              <AnimatedCounter 
                value={stats.totalValue ?? 0} 
                formatFn={formatCurrency}
              />
            </h3>
            <p className="text-sm text-slate-300 mt-1">Portfolio Value</p>
            <p className="text-xs text-slate-400">All contracts</p>
            {sparklines.value.length > 0 && (
              <div className="absolute bottom-3 right-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <Sparkline data={sparklines.value} color="green" height={24} />
              </div>
            )}
          </motion.div>

          {/* Risk Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 md:p-5 hover:bg-white/15 transition-all cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
              <Shield className="w-full h-full text-white" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div className={cn(
                "p-2 rounded-lg backdrop-blur-sm",
                (stats.avgRiskScore ?? 0) < 30 ? "bg-emerald-500/20" : (stats.avgRiskScore ?? 0) < 70 ? "bg-amber-500/20" : "bg-red-500/20"
              )}>
                <Shield className={cn(
                  "h-4 w-4",
                  (stats.avgRiskScore ?? 0) < 30 ? "text-emerald-300" : (stats.avgRiskScore ?? 0) < 70 ? "text-amber-300" : "text-red-300"
                )} />
              </div>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              <AnimatedCounter value={stats.avgRiskScore ?? 0} suffix="%" />
            </h3>
            <p className="text-sm text-slate-300 mt-1">Avg Risk Score</p>
            <p className={cn(
              "text-xs",
              (stats.avgRiskScore ?? 0) < 30 ? "text-emerald-400" : (stats.avgRiskScore ?? 0) < 70 ? "text-amber-400" : "text-red-400"
            )}>
              {(stats.avgRiskScore ?? 0) < 30 ? 'Low risk portfolio' : (stats.avgRiskScore ?? 0) < 70 ? 'Moderate risk' : 'High risk - attention needed'}
            </p>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 p-4 md:p-5 hover:bg-white/15 transition-all cursor-pointer"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
              <Zap className="w-full h-full text-white" />
            </div>
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 rounded-lg bg-purple-500/20 backdrop-blur-sm">
                <Zap className="h-4 w-4 text-purple-300" />
              </div>
              {(stats.recentlyAdded ?? 0) > 0 && (
                <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 backdrop-blur-sm">
                  <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-purple-400" />
                  New
                </div>
              )}
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              <AnimatedCounter value={stats.recentlyAdded ?? 0} />
            </h3>
            <p className="text-sm text-slate-300 mt-1">Recently Added</p>
            <p className="text-xs text-slate-400">Last 7 days</p>
          </motion.div>
        </div>
      </motion.div>

      {/* Alerts Row - Outside Hero */}
      {((stats.expiringSoon ?? 0) > 0 || (stats.highRisk ?? 0) > 0 || (stats.pendingReview ?? 0) > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {(stats.expiringSoon ?? 0) > 0 && (
            <AlertCard
              title="Expiring Soon"
              count={stats.expiringSoon ?? 0}
              icon={Clock}
              color="amber"
              description={`${stats.expiringThisWeek ?? 0} this week`}
            />
          )}
          {(stats.highRisk ?? stats.highRiskContracts ?? 0) > 0 && (
            <AlertCard
              title="High Risk"
              count={stats.highRisk ?? stats.highRiskContracts ?? 0}
              icon={AlertTriangle}
              color="red"
              description="Require immediate attention"
            />
          )}
          {stats.pendingReview > 0 && (
            <AlertCard
              title="Pending Review"
              count={stats.pendingReview}
              icon={AlertCircle}
              color="amber"
              description="Awaiting your approval"
            />
          )}
        </motion.div>
      )}
    </div>
  );
});

export default ContractsHeroDashboard;

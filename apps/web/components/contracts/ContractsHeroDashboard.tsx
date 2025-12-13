/**
 * Contracts Hero Dashboard
 * A visually striking stats dashboard header for the contracts page
 */

'use client';

import React, { useMemo, memo } from 'react';
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
    contracts: generateSparkline(stats.trends.contracts),
    value: generateSparkline(stats.trends.value),
    risk: generateSparkline(-stats.trends.risk),
  }), [stats.trends]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-slate-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold text-slate-900">
            Contract Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of your contract portfolio
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <QuickAction
            label="Upload"
            icon={Upload}
            color="blue"
            onClick={onUploadClick}
            href="/contracts/upload"
          />
          <QuickAction
            label="Generate"
            icon={Sparkles}
            color="purple"
            onClick={onGenerateClick}
            href="/contracts/generate"
          />
          <QuickAction
            label="Compare"
            icon={GitCompare}
            color="cyan"
            onClick={onCompareClick}
          />
        </motion.div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contracts"
          value={stats.totalContracts.toLocaleString()}
          subtitle={`${stats.activeContracts} active`}
          icon={FileText}
          trend={stats.trends.contracts}
          color="blue"
          sparklineData={sparklines.contracts}
          delay={0}
        />
        <StatCard
          title="Total Value"
          value={formatCurrency(stats.totalValue)}
          subtitle="Across all contracts"
          icon={DollarSign}
          trend={stats.trends.value}
          color="green"
          sparklineData={sparklines.value}
          delay={0.1}
        />
        <StatCard
          title="Avg. Risk Score"
          value={`${stats.avgRiskScore}%`}
          subtitle={stats.avgRiskScore < 30 ? 'Low risk' : stats.avgRiskScore < 70 ? 'Medium risk' : 'High risk'}
          icon={Shield}
          trend={stats.trends.risk}
          color={stats.avgRiskScore < 30 ? 'green' : stats.avgRiskScore < 70 ? 'amber' : 'red'}
          sparklineData={sparklines.risk}
          delay={0.2}
        />
        <StatCard
          title="Recently Added"
          value={stats.recentlyAdded}
          subtitle="Last 7 days"
          icon={Zap}
          color="purple"
          delay={0.3}
        />
      </div>

      {/* Alerts Row */}
      {(stats.expiringSoon > 0 || stats.highRisk > 0 || stats.pendingReview > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {stats.expiringSoon > 0 && (
            <AlertCard
              title="Expiring Soon"
              count={stats.expiringSoon}
              icon={Clock}
              color="amber"
              description="Within the next 30 days"
            />
          )}
          {stats.highRisk > 0 && (
            <AlertCard
              title="High Risk"
              count={stats.highRisk}
              icon={AlertTriangle}
              color="red"
              description="Contracts need attention"
            />
          )}
          {stats.pendingReview > 0 && (
            <AlertCard
              title="Pending Review"
              count={stats.pendingReview}
              icon={AlertCircle}
              color="amber"
              description="Awaiting your review"
            />
          )}
        </motion.div>
      )}
    </div>
  );
});

export default ContractsHeroDashboard;

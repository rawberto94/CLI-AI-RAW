'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  DollarSign,
  Users,
  Calendar,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface HealthFactor {
  id: string;
  name: string;
  score: number; // 0-100
  weight: number; // 0-1, weights sum to 1
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  description: string;
  recommendation?: string;
}

interface ContractHealthScoreProps {
  contractId: string;
  factors?: HealthFactor[];
  className?: string;
  variant?: 'full' | 'compact' | 'mini';
}

// ============================================================================
// Score Ring Component
// ============================================================================

function HealthScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (score: number) => {
    if (score >= 80) return { stroke: '#7C3AED', bg: 'from-violet-500 to-purple-500', text: 'text-violet-600' };
    if (score >= 60) return { stroke: '#f59e0b', bg: 'from-amber-500 to-orange-500', text: 'text-amber-600' };
    return { stroke: '#ef4444', bg: 'from-red-500 to-rose-500', text: 'text-red-600' };
  };

  const colors = getColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background glow */}
      <div
        className={cn(
          "absolute inset-4 rounded-full blur-xl opacity-30",
          `bg-gradient-to-br ${colors.bg}`
        )}
      />
      
      {/* SVG Ring */}
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200"
        />
        {/* Progress circle */}
        <motion.circle
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className={cn("text-3xl font-bold", colors.text)}
        >
          {score}
        </motion.span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

// ============================================================================
// Factor Row Component
// ============================================================================

function HealthFactorRow({ factor }: { factor: HealthFactor }) {
  const statusColors = {
    healthy: { bg: 'bg-violet-100', text: 'text-violet-700', icon: CheckCircle2 },
    warning: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
    critical: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle },
  };

  const trendIcons = {
    up: TrendingUp,
    down: TrendingDown,
    stable: Minus,
  };

  const style = statusColors[factor.status];
  const TrendIcon = trendIcons[factor.trend];
  const StatusIcon = style.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
    >
      <div className={cn("p-1.5 rounded-lg", style.bg)}>
        <StatusIcon className={cn("w-4 h-4", style.text)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-slate-900">{factor.name}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-slate-400" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{factor.description}</p>
                {factor.recommendation && (
                  <p className="mt-1 text-xs text-slate-400">
                    💡 {factor.recommendation}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Progress value={factor.score} className="h-1.5 mt-1" />
      </div>
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">{factor.score}</span>
        <TrendIcon
          className={cn(
            "w-4 h-4",
            factor.trend === 'up' && 'text-violet-500',
            factor.trend === 'down' && 'text-red-500',
            factor.trend === 'stable' && 'text-slate-400'
          )}
        />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContractHealthScore({
  contractId,
  factors: propFactors,
  className,
  variant = 'full',
}: ContractHealthScoreProps) {
  // Default factors for demo
  const defaultFactors: HealthFactor[] = [
    {
      id: 'compliance',
      name: 'Compliance',
      score: 92,
      weight: 0.25,
      status: 'healthy',
      trend: 'up',
      description: 'Contract meets all regulatory requirements and internal policies.',
      recommendation: 'Consider adding GDPR addendum for EU operations.',
    },
    {
      id: 'financial',
      name: 'Financial Terms',
      score: 85,
      weight: 0.20,
      status: 'healthy',
      trend: 'stable',
      description: 'Payment terms, pricing, and financial obligations are clearly defined.',
    },
    {
      id: 'risk',
      name: 'Risk Assessment',
      score: 68,
      weight: 0.20,
      status: 'warning',
      trend: 'down',
      description: 'Some risk factors require attention.',
      recommendation: 'Review liability caps and indemnification clauses.',
    },
    {
      id: 'completeness',
      name: 'Document Completeness',
      score: 95,
      weight: 0.15,
      status: 'healthy',
      trend: 'up',
      description: 'All required sections and attachments are present.',
    },
    {
      id: 'expiration',
      name: 'Timeline Health',
      score: 72,
      weight: 0.10,
      status: 'warning',
      trend: 'stable',
      description: 'Contract expires in 45 days.',
      recommendation: 'Initiate renewal discussions with the counterparty.',
    },
    {
      id: 'obligations',
      name: 'Obligation Tracking',
      score: 88,
      weight: 0.10,
      status: 'healthy',
      trend: 'up',
      description: 'All obligations are tracked and on schedule.',
    },
  ];

  const factors = propFactors || defaultFactors;

  // Calculate overall score
  const overallScore = useMemo(() => {
    const weightedSum = factors.reduce(
      (sum, factor) => sum + factor.score * factor.weight,
      0
    );
    return Math.round(weightedSum);
  }, [factors]);

  const getOverallStatus = (score: number) => {
    if (score >= 80) return { label: 'Healthy', color: 'text-violet-600', bg: 'bg-violet-100' };
    if (score >= 60) return { label: 'Needs Attention', color: 'text-amber-600', bg: 'bg-amber-100' };
    return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const status = getOverallStatus(overallScore);

  // Mini variant - just the score badge
  if (variant === 'mini') {
    return (
      <Badge
        className={cn(
          "gap-1.5 px-2.5 py-1",
          status.bg,
          status.color,
          className
        )}
      >
        <Shield className="w-3 h-3" />
        {overallScore}
      </Badge>
    );
  }

  // Compact variant - score ring only
  if (variant === 'compact') {
    return (
      <Card className={cn("shadow-sm border-slate-200/50", className)}>
        <CardContent className="p-4 flex items-center gap-4">
          <HealthScoreRing score={overallScore} size={80} strokeWidth={8} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Health Score</span>
              <Badge className={cn(status.bg, status.color, "text-xs")}>
                {status.label}
              </Badge>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Based on {factors.length} health factors
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full variant
  return (
    <Card className={cn("shadow-sm border-slate-200/50 overflow-hidden", className)}>
      <CardHeader className="pb-4 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600">
              <Shield className="w-4 h-4 text-white" />
            </div>
            Contract Health Score
          </CardTitle>
          <Badge className={cn(status.bg, status.color)}>
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Score Ring Section */}
        <div className="flex items-center justify-center py-4">
          <div className="text-center">
            <HealthScoreRing score={overallScore} />
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 text-sm text-slate-500"
            >
              Overall contract health based on {factors.length} factors
            </motion.p>
          </div>
        </div>

        {/* Factors List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Health Factors
            </span>
            <Sparkles className="w-3 h-3 text-violet-500" />
          </div>
          {factors.map((factor) => (
            <HealthFactorRow key={factor.id} factor={factor} />
          ))}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="text-center">
            <div className="text-lg font-bold text-violet-600">
              {factors.filter((f) => f.status === 'healthy').length}
            </div>
            <div className="text-xs text-slate-500">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-amber-600">
              {factors.filter((f) => f.status === 'warning').length}
            </div>
            <div className="text-xs text-slate-500">Warning</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              {factors.filter((f) => f.status === 'critical').length}
            </div>
            <div className="text-xs text-slate-500">Critical</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Health Score Widget (for dashboard)
// ============================================================================

interface HealthScoreWidgetProps {
  contracts: Array<{
    id: string;
    title: string;
    score: number;
    status: 'healthy' | 'warning' | 'critical';
    trend: 'up' | 'down' | 'stable';
  }>;
  className?: string;
}

export function HealthScoreWidget({ contracts, className }: HealthScoreWidgetProps) {
  const averageScore = useMemo(() => {
    if (contracts.length === 0) return 0;
    return Math.round(
      contracts.reduce((sum, c) => sum + c.score, 0) / contracts.length
    );
  }, [contracts]);

  const statusCounts = useMemo(() => ({
    healthy: contracts.filter((c) => c.status === 'healthy').length,
    warning: contracts.filter((c) => c.status === 'warning').length,
    critical: contracts.filter((c) => c.status === 'critical').length,
  }), [contracts]);

  return (
    <Card className={cn("shadow-sm border-slate-200/50", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-violet-500" />
          Portfolio Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <HealthScoreRing score={averageScore} size={60} strokeWidth={6} />
          <div>
            <div className="text-sm text-slate-500">Average Score</div>
            <div className="text-2xl font-bold text-slate-900">{averageScore}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 rounded-lg bg-violet-50 text-center">
            <div className="text-lg font-bold text-violet-600">{statusCounts.healthy}</div>
            <div className="text-xs text-violet-600">Healthy</div>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-center">
            <div className="text-lg font-bold text-amber-600">{statusCounts.warning}</div>
            <div className="text-xs text-amber-600">Warning</div>
          </div>
          <div className="p-2 rounded-lg bg-red-50 text-center">
            <div className="text-lg font-bold text-red-600">{statusCounts.critical}</div>
            <div className="text-xs text-red-600">Critical</div>
          </div>
        </div>

        {/* Top contracts needing attention */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Needs Attention
          </div>
          {contracts
            .filter((c) => c.status !== 'healthy')
            .slice(0, 3)
            .map((contract) => (
              <div
                key={contract.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      contract.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    )}
                  />
                  <span className="text-sm text-slate-900 truncate max-w-[150px]">
                    {contract.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-slate-600">
                    {contract.score}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default ContractHealthScore;

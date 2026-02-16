'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  FileWarning,
  Scale,
  Zap,
  Info,
  ChevronDown,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    transition?: object;
    whileHover?: object;
    className?: string;
  }
>;

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFactor {
  id: string;
  category: 'financial' | 'legal' | 'operational' | 'compliance' | 'vendor' | 'timeline';
  title: string;
  description: string;
  severity: RiskLevel;
  impact?: string;
  recommendation?: string;
  autoDetected?: boolean;
}

interface AIRiskAssessmentProps {
  overallScore: number; // 0-100
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  aiConfidence?: number; // 0-100
  lastUpdated?: Date;
  contractValue?: number;
  compact?: boolean;
  expandable?: boolean;
  onViewDetails?: () => void;
  className?: string;
}

/**
 * Get risk level configuration (colors, icons, labels)
 */
const getRiskConfig = (level: RiskLevel) => {
  switch (level) {
    case 'critical':
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        gradientFrom: 'from-red-500',
        gradientTo: 'to-rose-600',
        icon: ShieldX,
        label: 'Critical Risk',
        description: 'Immediate action required',
      };
    case 'high':
      return {
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        gradientFrom: 'from-orange-500',
        gradientTo: 'to-amber-600',
        icon: ShieldAlert,
        label: 'High Risk',
        description: 'Careful review recommended',
      };
    case 'medium':
      return {
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        gradientFrom: 'from-amber-500',
        gradientTo: 'to-yellow-600',
        icon: Shield,
        label: 'Medium Risk',
        description: 'Some concerns identified',
      };
    case 'low':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        gradientFrom: 'from-violet-500',
        gradientTo: 'to-violet-600',
        icon: ShieldCheck,
        label: 'Low Risk',
        description: 'Minimal concerns',
      };
  }
};

const getCategoryIcon = (category: RiskFactor['category']) => {
  switch (category) {
    case 'financial': return DollarSign;
    case 'legal': return Scale;
    case 'operational': return Zap;
    case 'compliance': return FileWarning;
    case 'vendor': return TrendingDown;
    case 'timeline': return Clock;
    default: return AlertTriangle;
  }
};

const getCategoryLabel = (category: RiskFactor['category']) => {
  switch (category) {
    case 'financial': return 'Financial';
    case 'legal': return 'Legal';
    case 'operational': return 'Operational';
    case 'compliance': return 'Compliance';
    case 'vendor': return 'Vendor';
    case 'timeline': return 'Timeline';
    default: return 'Other';
  }
};

/**
 * Compact risk badge for list views
 */
interface AIRiskBadgeProps {
  riskLevel: RiskLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AIRiskBadge({
  riskLevel,
  score,
  showScore = false,
  size = 'md',
  className,
}: AIRiskBadgeProps) {
  const config = getRiskConfig(riskLevel);
  const Icon = config.icon;

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2 py-1 text-xs gap-1.5',
    lg: 'px-3 py-1.5 text-sm gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium border',
        sizeStyles[size],
        config.bgColor,
        config.borderColor,
        config.color,
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{config.label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-70">({score})</span>
      )}
      <Sparkles className={cn(iconSizes[size], 'opacity-50')} />
    </span>
  );
}

/**
 * Risk score gauge visualization
 */
interface RiskScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function RiskScoreGauge({
  score,
  size = 'md',
  showLabel = true,
  className,
}: RiskScoreGaugeProps) {
  const getColorFromScore = (score: number) => {
    if (score >= 80) return { color: 'text-red-600', bg: 'stroke-red-500' };
    if (score >= 60) return { color: 'text-orange-600', bg: 'stroke-orange-500' };
    if (score >= 40) return { color: 'text-amber-600', bg: 'stroke-amber-500' };
    return { color: 'text-green-600', bg: 'stroke-green-500' };
  };

  const colors = getColorFromScore(score);
  
  const sizes = {
    sm: { size: 48, stroke: 4, fontSize: 'text-xs' },
    md: { size: 64, stroke: 5, fontSize: 'text-sm' },
    lg: { size: 80, stroke: 6, fontSize: 'text-base' },
  };

  const { size: svgSize, stroke, fontSize } = sizes[size];
  const radius = (svgSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={svgSize} height={svgSize} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200"
        />
        {/* Progress circle */}
        <motion.circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={colors.bg}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className={cn('absolute inset-0 flex flex-col items-center justify-center', colors.color)}>
        <span className={cn('font-bold', fontSize)}>{score}</span>
        {showLabel && <span className="text-[10px] opacity-70">Risk</span>}
      </div>
    </div>
  );
}

/**
 * Full AI Risk Assessment panel
 */
export function AIRiskAssessment({
  overallScore,
  riskLevel,
  factors,
  aiConfidence = 85,
  lastUpdated,
  contractValue,
  compact = false,
  expandable = true,
  onViewDetails,
  className,
}: AIRiskAssessmentProps) {
  const [isExpanded, setIsExpanded] = React.useState(!compact);
  const config = getRiskConfig(riskLevel);
  const Icon = config.icon;

  // Group factors by category
  const groupedFactors = factors.reduce((acc, factor) => {
    if (!acc[factor.category]) acc[factor.category] = [];
    acc[factor.category]!.push(factor);
    return acc;
  }, {} as Record<string, RiskFactor[]>);

  // Calculate category counts by severity
  const severityCounts = {
    critical: factors.filter(f => f.severity === 'critical').length,
    high: factors.filter(f => f.severity === 'high').length,
    medium: factors.filter(f => f.severity === 'medium').length,
    low: factors.filter(f => f.severity === 'low').length,
  };

  if (compact) {
    return (
      <button
        onClick={() => expandable && setIsExpanded(!isExpanded)}
        className={cn(
          'w-full p-3 rounded-xl border transition-all hover:shadow-md',
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg bg-gradient-to-br',
              config.gradientFrom,
              config.gradientTo
            )}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className={cn('font-semibold text-sm', config.color)}>
                {config.label}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI Analysis • {aiConfidence}% confidence
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RiskScoreGauge score={overallScore} size="sm" showLabel={false} />
            {expandable && (
              <ChevronDown className={cn(
                'w-4 h-4 text-slate-400 transition-transform',
                isExpanded && 'rotate-180'
              )} />
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      config.bgColor,
      config.borderColor,
      className
    )}>
      {/* Header */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-slate-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-xl bg-gradient-to-br shadow-lg',
              config.gradientFrom,
              config.gradientTo
            )}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className={cn('font-bold text-lg flex items-center gap-2', config.color)}>
                {config.label}
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  AI-Powered
                </span>
              </h3>
              <p className="text-sm text-slate-500">{config.description}</p>
            </div>
          </div>
          <RiskScoreGauge score={overallScore} size="md" />
        </div>

        {/* Severity summary */}
        <div className="mt-4 flex items-center gap-3">
          {severityCounts.critical > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
              {severityCounts.critical} Critical
            </span>
          )}
          {severityCounts.high > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
              {severityCounts.high} High
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
              {severityCounts.medium} Medium
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
              {severityCounts.low} Low
            </span>
          )}
        </div>
      </div>

      {/* Risk Factors */}
      <div className="p-4 space-y-4">
        {Object.entries(groupedFactors).map(([category, categoryFactors]) => {
          const CategoryIcon = getCategoryIcon(category as RiskFactor['category']);
          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-2">
                <CategoryIcon className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-700">
                  {getCategoryLabel(category as RiskFactor['category'])}
                </h4>
              </div>
              <div className="space-y-2 pl-6">
                {categoryFactors.map((factor) => {
                  const factorConfig = getRiskConfig(factor.severity);
                  return (
                    <MotionDiv
                      key={factor.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        'p-3 rounded-lg border',
                        factorConfig.bgColor,
                        factorConfig.borderColor
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className={cn('font-medium text-sm', factorConfig.color)}>
                            {factor.title}
                            {factor.autoDetected && (
                              <span className="ml-2 text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded">
                                Auto-detected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{factor.description}</p>
                          {factor.recommendation && (
                            <p className="text-xs text-slate-600 mt-2 italic">
                              💡 {factor.recommendation}
                            </p>
                          )}
                        </div>
                        <AIRiskBadge riskLevel={factor.severity} size="sm" />
                      </div>
                    </MotionDiv>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Sparkles className="w-3 h-3" />
          <span>AI Confidence: {aiConfidence}%</span>
          {lastUpdated && (
            <>
              <span>•</span>
              <span>Updated {lastUpdated.toLocaleDateString()}</span>
            </>
          )}
        </div>
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-xs text-violet-600 hover:text-indigo-800 font-medium flex items-center gap-1"
          >
            View Full Analysis
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Generate mock risk factors for demo purposes
 */
export function generateMockRiskFactors(contractValue?: number): RiskFactor[] {
  const factors: RiskFactor[] = [];
  
  // High value contract risk
  if (contractValue && contractValue > 100000) {
    factors.push({
      id: 'value-1',
      category: 'financial',
      title: 'High Contract Value',
      description: `Contract value of $${contractValue.toLocaleString()} exceeds standard approval threshold`,
      severity: contractValue > 500000 ? 'high' : 'medium',
      impact: 'Requires executive approval',
      recommendation: 'Ensure CFO review is included in approval workflow',
      autoDetected: true,
    });
  }

  // Random additional factors for demo
  const possibleFactors: RiskFactor[] = [
    {
      id: 'legal-1',
      category: 'legal',
      title: 'Non-standard Liability Clause',
      description: 'Unlimited liability exposure detected in Section 8.2',
      severity: 'high',
      impact: 'Potential financial exposure',
      recommendation: 'Negotiate liability cap at 2x contract value',
      autoDetected: true,
    },
    {
      id: 'vendor-1',
      category: 'vendor',
      title: 'New Vendor - Limited History',
      description: 'First contract with this vendor, no performance history',
      severity: 'medium',
      impact: 'Delivery risk',
      recommendation: 'Add performance milestones and review clauses',
      autoDetected: true,
    },
    {
      id: 'compliance-1',
      category: 'compliance',
      title: 'Missing Data Protection Terms',
      description: 'No GDPR/data processing agreement detected',
      severity: 'high',
      impact: 'Regulatory compliance risk',
      recommendation: 'Add standard DPA as exhibit',
      autoDetected: true,
    },
    {
      id: 'timeline-1',
      category: 'timeline',
      title: 'Auto-renewal Clause',
      description: '30-day notice required for termination, auto-renews annually',
      severity: 'medium',
      impact: 'May lock into unfavorable terms',
      recommendation: 'Set calendar reminder 60 days before renewal',
      autoDetected: true,
    },
  ];

  // Add 2-3 random factors
  const shuffled = possibleFactors.sort(() => 0.5 - Math.random());
  factors.push(...shuffled.slice(0, Math.floor(Math.random() * 2) + 2));

  return factors;
}

export default AIRiskAssessment;

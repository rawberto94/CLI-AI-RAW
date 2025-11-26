'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Users,
  Calendar,
  Tag,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Sparkles,
  Scale,
  FileCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRiskColor, getComplianceColor, formatCurrency, formatDate } from '@/lib/design-tokens'

// ============ TYPES ============

interface ArtifactBaseProps {
  className?: string
  isLoading?: boolean
}

interface Party {
  name: string
  role: string
  email?: string
  address?: string
}

interface KeyTerm {
  term: string
  value: string
  confidence?: number
}

interface Clause {
  id: string
  title: string
  content: string
  type: string
  importance: 'high' | 'medium' | 'low'
  obligations?: string[]
  risks?: string[]
}

interface RiskFactor {
  id: string
  category: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  mitigation?: string
}

interface ComplianceIssue {
  id: string
  regulation: string
  requirement: string
  status: 'compliant' | 'non-compliant' | 'review-needed'
  details?: string
}

interface RateCard {
  id: string
  role: string
  rate: number
  unit: string
  currency: string
}

// ============ HELPER COMPONENTS ============

function ConfidenceIndicator({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const getColor = () => {
    if (value >= 90) return 'bg-emerald-500';
    if (value >= 70) return 'bg-amber-500';
    return 'bg-rose-500';
  };
  
  const sizeClasses = size === 'sm' ? 'h-1 w-12' : 'h-1.5 w-16';
  
  return (
    <div className="flex items-center gap-2">
      <div className={cn("bg-slate-200 rounded-full overflow-hidden", sizeClasses)}>
        <div
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">{value}%</span>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  const config = {
    critical: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Critical' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
    low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' }
  }[severity];
  
  return (
    <Badge className={cn(config.bg, config.text, 'text-[10px] px-1.5 py-0')}>
      {config.label}
    </Badge>
  );
}

function ImportanceDot({ importance }: { importance: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-rose-500',
    medium: 'bg-amber-500',
    low: 'bg-slate-300'
  };
  
  return (
    <span className={cn("w-2 h-2 rounded-full shrink-0", colors[importance])} />
  );
}

function ExpandableSection({ 
  title, 
  children, 
  defaultOpen = false,
  badge,
  icon: Icon
}: { 
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
  icon?: React.ElementType
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="h-4 w-4 text-slate-400" />}
          <span className="font-medium text-slate-900">{title}</span>
          {badge}
        </div>
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-slate-400 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 border-t border-slate-200">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ METRIC CARD ============

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ElementType
  trend?: { value: number; label?: string }
  color: 'blue' | 'green' | 'amber' | 'rose' | 'purple' | 'slate'
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  color,
  className 
}: MetricCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      iconBg: 'from-blue-500 to-cyan-500',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-emerald-50',
      iconBg: 'from-emerald-500 to-green-500',
      text: 'text-emerald-600'
    },
    amber: {
      bg: 'bg-amber-50',
      iconBg: 'from-amber-500 to-orange-500',
      text: 'text-amber-600'
    },
    rose: {
      bg: 'bg-rose-50',
      iconBg: 'from-rose-500 to-red-500',
      text: 'text-rose-600'
    },
    purple: {
      bg: 'bg-purple-50',
      iconBg: 'from-purple-500 to-pink-500',
      text: 'text-purple-600'
    },
    slate: {
      bg: 'bg-slate-50',
      iconBg: 'from-slate-500 to-gray-500',
      text: 'text-slate-600'
    }
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 transition-all hover:shadow-lg hover:border-slate-300/80",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.value > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className={cn(
                "text-xs font-medium",
                trend.value > 0 ? "text-emerald-600" : trend.value < 0 ? "text-rose-600" : "text-slate-500"
              )}>
                {trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
              {trend.label && (
                <span className="text-xs text-slate-400">{trend.label}</span>
              )}
            </div>
          )}
        </div>
        <div className={cn(
          "p-3 rounded-xl bg-gradient-to-br shadow-sm",
          colorClasses.iconBg
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      
      {/* Decorative accent */}
      <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity bg-gradient-to-br from-current to-transparent" style={{ color: `var(--${color}-500)` }} />
    </motion.div>
  );
}

// ============ SCORE RING ============

interface ScoreRingProps {
  score: number
  maxScore?: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  color?: 'auto' | 'blue' | 'green' | 'amber' | 'rose'
}

export function ScoreRing({ 
  score, 
  maxScore = 100, 
  size = 'md', 
  label,
  color = 'auto'
}: ScoreRingProps) {
  const percentage = (score / maxScore) * 100;
  
  const sizeConfig = {
    sm: { ring: 60, stroke: 6, text: 'text-lg', label: 'text-[10px]' },
    md: { ring: 80, stroke: 8, text: 'text-2xl', label: 'text-xs' },
    lg: { ring: 100, stroke: 10, text: 'text-3xl', label: 'text-sm' }
  }[size];
  
  const getColor = () => {
    if (color !== 'auto') return color;
    if (percentage >= 70) return 'emerald';
    if (percentage >= 40) return 'amber';
    return 'rose';
  };
  
  const colorValue = getColor();
  const strokeColor = {
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    blue: '#3b82f6',
    green: '#22c55e'
  }[colorValue];
  
  const circumference = 2 * Math.PI * ((sizeConfig.ring - sizeConfig.stroke) / 2);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={sizeConfig.ring} height={sizeConfig.ring} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={sizeConfig.ring / 2}
          cy={sizeConfig.ring / 2}
          r={(sizeConfig.ring - sizeConfig.stroke) / 2}
          stroke="#e2e8f0"
          strokeWidth={sizeConfig.stroke}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={sizeConfig.ring / 2}
          cy={sizeConfig.ring / 2}
          r={(sizeConfig.ring - sizeConfig.stroke) / 2}
          stroke={strokeColor}
          strokeWidth={sizeConfig.stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-bold text-slate-900", sizeConfig.text)}>
          {score}
        </span>
        {label && (
          <span className={cn("text-slate-500", sizeConfig.label)}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ============ OVERVIEW ARTIFACT ============

interface OverviewArtifactProps extends ArtifactBaseProps {
  data: {
    title?: string
    summary?: string
    parties?: Party[]
    dates?: {
      effective?: string
      expiration?: string
      signed?: string
    }
    keyTerms?: KeyTerm[]
    contractType?: string
    jurisdiction?: string
    confidence?: number
  }
}

export function OverviewArtifact({ data, className, isLoading }: OverviewArtifactProps) {
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);
  
  const copyTerm = (term: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedTerm(term);
    setTimeout(() => setCopiedTerm(null), 2000);
  };

  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with confidence */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {data.title || 'Contract Overview'}
          </h3>
          {data.contractType && (
            <Badge variant="secondary" className="mt-2 bg-slate-100">
              {data.contractType}
            </Badge>
          )}
        </div>
        {data.confidence && (
          <div className="text-right">
            <span className="text-xs text-slate-500 block mb-1">Confidence</span>
            <ConfidenceIndicator value={data.confidence} size="md" />
          </div>
        )}
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200/50">
          <p className="text-sm text-slate-700 leading-relaxed">{data.summary}</p>
        </div>
      )}
      
      {/* Parties */}
      {data.parties && data.parties.length > 0 && (
        <ExpandableSection 
          title="Contract Parties" 
          icon={Users}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.parties.length}</Badge>}
          defaultOpen
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.parties.map((party, i) => (
              <div 
                key={i} 
                className="p-4 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge 
                    variant="outline"
                    className="text-[10px] border-indigo-200 text-indigo-600"
                  >
                    {party.role}
                  </Badge>
                </div>
                <p className="font-medium text-slate-900">{party.name}</p>
                {party.email && (
                  <p className="text-sm text-slate-500 mt-1">{party.email}</p>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
      
      {/* Key Dates */}
      {data.dates && (
        <ExpandableSection title="Key Dates" icon={Calendar} defaultOpen>
          <div className="grid grid-cols-3 gap-4">
            {data.dates.effective && (
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Effective</p>
                <p className="font-semibold text-slate-900 mt-1">{formatDate(data.dates.effective)}</p>
              </div>
            )}
            {data.dates.signed && (
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">Signed</p>
                <p className="font-semibold text-slate-900 mt-1">{formatDate(data.dates.signed)}</p>
              </div>
            )}
            {data.dates.expiration && (
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Expires</p>
                <p className="font-semibold text-slate-900 mt-1">{formatDate(data.dates.expiration)}</p>
              </div>
            )}
          </div>
        </ExpandableSection>
      )}
      
      {/* Key Terms */}
      {data.keyTerms && data.keyTerms.length > 0 && (
        <ExpandableSection 
          title="Key Terms" 
          icon={Tag}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.keyTerms.length}</Badge>}
        >
          <div className="space-y-2">
            {data.keyTerms.map((item, i) => (
              <div 
                key={i}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-slate-500 shrink-0">{item.term}:</span>
                  <span className="font-medium text-slate-900 truncate">{item.value}</span>
                  {item.confidence && <ConfidenceIndicator value={item.confidence} />}
                </div>
                <button
                  onClick={() => copyTerm(item.term, item.value)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-200 rounded"
                >
                  {copiedTerm === item.term ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ CLAUSES ARTIFACT ============

interface ClausesArtifactProps extends ArtifactBaseProps {
  data: {
    clauses: Clause[]
    totalCount?: number
  }
}

export function ClausesArtifact({ data, className, isLoading }: ClausesArtifactProps) {
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  
  const toggleClause = (id: string) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const filteredClauses = filter === 'all' 
    ? data.clauses 
    : data.clauses.filter(c => c.importance === filter);
  
  const importanceCounts = {
    high: data.clauses.filter(c => c.importance === 'high').length,
    medium: data.clauses.filter(c => c.importance === 'medium').length,
    low: data.clauses.filter(c => c.importance === 'low').length
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Key Clauses</h3>
          <p className="text-sm text-slate-500 mt-1">
            {data.totalCount || data.clauses.length} clauses extracted
          </p>
        </div>
        
        {/* Filter Pills */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                filter === f 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && (
                <span className="ml-1 text-slate-400">
                  ({importanceCounts[f]})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Clauses List */}
      <div className="space-y-3">
        {filteredClauses.map((clause) => {
          const isExpanded = expandedClauses.has(clause.id);
          
          return (
            <motion.div
              key={clause.id}
              layout
              className={cn(
                "border rounded-xl overflow-hidden transition-colors",
                isExpanded ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 bg-white hover:border-slate-300"
              )}
            >
              <button
                onClick={() => toggleClause(clause.id)}
                className="w-full p-4 flex items-start gap-3 text-left"
              >
                <ImportanceDot importance={clause.importance} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{clause.title}</span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-100">
                      {clause.type}
                    </Badge>
                  </div>
                  {!isExpanded && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                      {clause.content}
                    </p>
                  )}
                </div>
                <ChevronRight className={cn(
                  "h-4 w-4 text-slate-400 transition-transform shrink-0",
                  isExpanded && "rotate-90"
                )} />
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200"
                  >
                    <div className="p-4 space-y-4">
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {clause.content}
                      </p>
                      
                      {clause.obligations && clause.obligations.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Obligations
                          </h5>
                          <ul className="space-y-1">
                            {clause.obligations.map((ob, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                {ob}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {clause.risks && clause.risks.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Risks
                          </h5>
                          <ul className="space-y-1">
                            {clause.risks.map((risk, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                {risk}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ============ RISK ARTIFACT ============

interface RiskArtifactProps extends ArtifactBaseProps {
  data: {
    overallScore: number
    riskLevel: 'critical' | 'high' | 'medium' | 'low'
    factors: RiskFactor[]
    summary?: string
  }
}

export function RiskArtifact({ data, className, isLoading }: RiskArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getRiskLevelConfig = (level: string) => {
    const configs = {
      critical: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
      medium: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
      low: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' }
    };
    return configs[level as keyof typeof configs] || configs.medium;
  };

  const levelConfig = getRiskLevelConfig(data.riskLevel);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Score */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing 
            score={data.overallScore} 
            size="lg"
            label="Risk"
          />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Risk Assessment</h3>
            <Badge className={cn("mt-1", levelConfig.bg, levelConfig.text)}>
              {data.riskLevel.toUpperCase()} RISK
            </Badge>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm text-slate-500">Factors Identified</p>
          <p className="text-2xl font-bold text-slate-900">{data.factors.length}</p>
        </div>
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className={cn(
          "p-4 rounded-xl border",
          levelConfig.bg,
          levelConfig.border
        )}>
          <div className="flex gap-3">
            <Info className={cn("h-5 w-5 shrink-0 mt-0.5", levelConfig.text)} />
            <p className="text-sm text-slate-700">{data.summary}</p>
          </div>
        </div>
      )}
      
      {/* Risk Factors */}
      <div className="space-y-3">
        {data.factors.map((factor) => (
          <ExpandableSection
            key={factor.id}
            title={factor.category}
            badge={<SeverityBadge severity={factor.severity} />}
          >
            <div className="space-y-4">
              <p className="text-sm text-slate-700">{factor.description}</p>
              
              {factor.mitigation && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <h5 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                    Recommended Mitigation
                  </h5>
                  <p className="text-sm text-emerald-800">{factor.mitigation}</p>
                </div>
              )}
            </div>
          </ExpandableSection>
        ))}
      </div>
    </div>
  );
}

// ============ FINANCIAL ARTIFACT ============

interface FinancialArtifactProps extends ArtifactBaseProps {
  data: {
    totalValue?: number
    currency?: string
    paymentTerms?: string
    rates?: RateCard[]
    summary?: string
  }
}

export function FinancialArtifact({ data, className, isLoading }: FinancialArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Financial Analysis</h3>
        {data.totalValue && (
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Value</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(data.totalValue, data.currency)}
            </p>
          </div>
        )}
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50/50 rounded-xl border border-green-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}
      
      {/* Payment Terms */}
      {data.paymentTerms && (
        <div className="p-4 bg-slate-50 rounded-xl">
          <h4 className="text-sm font-semibold text-slate-700 mb-2">Payment Terms</h4>
          <p className="text-sm text-slate-600">{data.paymentTerms}</p>
        </div>
      )}
      
      {/* Rate Cards */}
      {data.rates && data.rates.length > 0 && (
        <ExpandableSection 
          title="Rate Cards" 
          icon={DollarSign}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.rates.length}</Badge>}
          defaultOpen
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Role</th>
                  <th className="text-right py-2 font-medium text-slate-600">Rate</th>
                  <th className="text-right py-2 font-medium text-slate-600">Unit</th>
                </tr>
              </thead>
              <tbody>
                {data.rates.map((rate, i) => (
                  <tr key={rate.id || i} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-900">{rate.role}</td>
                    <td className="py-3 text-right font-medium text-slate-900">
                      {formatCurrency(rate.rate, rate.currency)}
                    </td>
                    <td className="py-3 text-right text-slate-500">{rate.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ COMPLIANCE ARTIFACT ============

interface ComplianceArtifactProps extends ArtifactBaseProps {
  data: {
    score: number
    issues: ComplianceIssue[]
    regulations?: string[]
    summary?: string
  }
}

export function ComplianceArtifact({ data, className, isLoading }: ComplianceArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getStatusConfig = (status: ComplianceIssue['status']) => {
    return {
      'compliant': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
      'non-compliant': { bg: 'bg-rose-100', text: 'text-rose-700', icon: AlertTriangle },
      'review-needed': { bg: 'bg-amber-100', text: 'text-amber-700', icon: Info }
    }[status];
  };

  const statusCounts = {
    compliant: data.issues.filter(i => i.status === 'compliant').length,
    'non-compliant': data.issues.filter(i => i.status === 'non-compliant').length,
    'review-needed': data.issues.filter(i => i.status === 'review-needed').length
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Score */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing 
            score={data.score} 
            size="lg"
            label="Score"
          />
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Compliance Check</h3>
            <p className="text-sm text-slate-500 mt-1">
              {data.regulations?.length || 0} regulations analyzed
            </p>
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-3">
          <div className="text-center px-3 py-2 bg-emerald-50 rounded-lg">
            <p className="text-lg font-bold text-emerald-700">{statusCounts.compliant}</p>
            <p className="text-[10px] text-emerald-600 uppercase">Compliant</p>
          </div>
          <div className="text-center px-3 py-2 bg-amber-50 rounded-lg">
            <p className="text-lg font-bold text-amber-700">{statusCounts['review-needed']}</p>
            <p className="text-[10px] text-amber-600 uppercase">Review</p>
          </div>
          <div className="text-center px-3 py-2 bg-rose-50 rounded-lg">
            <p className="text-lg font-bold text-rose-700">{statusCounts['non-compliant']}</p>
            <p className="text-[10px] text-rose-600 uppercase">Issues</p>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}
      
      {/* Regulations */}
      {data.regulations && data.regulations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.regulations.map((reg, i) => (
            <Badge 
              key={i} 
              variant="outline" 
              className="bg-white border-slate-200 text-slate-600"
            >
              <Scale className="h-3 w-3 mr-1" />
              {reg}
            </Badge>
          ))}
        </div>
      )}
      
      {/* Compliance Issues */}
      <div className="space-y-3">
        {data.issues.map((issue) => {
          const config = getStatusConfig(issue.status);
          const StatusIcon = config.icon;
          
          return (
            <div
              key={issue.id}
              className={cn(
                "p-4 rounded-xl border transition-colors",
                config.bg,
                "border-slate-200/50"
              )}
            >
              <div className="flex items-start gap-3">
                <StatusIcon className={cn("h-5 w-5 shrink-0 mt-0.5", config.text)} />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{issue.regulation}</span>
                    <Badge className={cn("text-[10px]", config.bg, config.text)}>
                      {issue.status.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{issue.requirement}</p>
                  {issue.details && (
                    <p className="text-xs text-slate-500 mt-2">{issue.details}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ SKELETON ============

function ArtifactSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded mt-2" />
        </div>
        <div className="h-16 w-16 bg-slate-200 rounded-full" />
      </div>
      <div className="h-20 bg-slate-100 rounded-xl" />
      <div className="space-y-3">
        <div className="h-16 bg-slate-100 rounded-xl" />
        <div className="h-16 bg-slate-100 rounded-xl" />
        <div className="h-16 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}

// ============ EXPORTS ============

export {
  ConfidenceIndicator,
  SeverityBadge,
  ImportanceDot,
  ExpandableSection,
  ArtifactSkeleton
};

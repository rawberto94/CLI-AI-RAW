'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
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
  FileCheck,
  Edit3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRiskColor, getComplianceColor, formatCurrency, formatDate } from '@/lib/design-tokens'

// ============ HELPER TO UNWRAP AI VALUES ============

/**
 * AI extraction may return values as { value: X, source: '...' } or just X
 * This helper unwraps them consistently
 */
function unwrapValue<T = string>(val: unknown): T | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return (val as { value: T }).value;
  }
  return val as T;
}

function unwrapString(val: unknown): string {
  const unwrapped = unwrapValue<string>(val);
  return typeof unwrapped === 'string' ? unwrapped : '';
}

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
  // Enhanced flexible fields
  sectionNumber?: string
  rawClauseText?: string
  crossReferences?: Array<{ from: string; to: string; context?: string }>
  definedTermsUsed?: string[]
  subclauses?: Array<{
    id: string
    sectionNumber?: string
    title?: string
    content: string
    rawText?: string
    subItems?: string[]
  }>
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
    if (value >= 90) return 'bg-violet-500';
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

function SeverityBadge({ severity }: { severity: string }) {
  const severityMap: Record<string, { bg: string; text: string; label: string }> = {
    critical: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Critical' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
    medium: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
    low: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' }
  };
  
  // Normalize severity to lowercase and get config, fallback to medium
  const normalizedSeverity = (severity || 'medium').toLowerCase();
  const config = severityMap[normalizedSeverity] ?? severityMap.medium;
  
  if (!config) {
    return <Badge className="text-[10px] px-1.5 py-0">Unknown</Badge>;
  }
  
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
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2.5 flex items-center justify-between bg-slate-50/30 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
          <span className="text-xs font-medium text-slate-700">{title}</span>
          {badge}
        </div>
        <ChevronDown 
          className={cn(
            "h-3.5 w-3.5 text-slate-400 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div key="open"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="p-3 border-t border-slate-100">
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
      bg: 'bg-violet-50',
      iconBg: 'from-violet-500 to-purple-500',
      text: 'text-violet-600'
    },
    green: {
      bg: 'bg-violet-50',
      iconBg: 'from-violet-500 to-purple-500',
      text: 'text-violet-600'
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
      bg: 'bg-violet-50',
      iconBg: 'from-violet-500 to-pink-500',
      text: 'text-violet-600'
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
                <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
              ) : trend.value < 0 ? (
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span className={cn(
                "text-xs font-medium",
                trend.value > 0 ? "text-violet-600" : trend.value < 0 ? "text-rose-600" : "text-slate-500"
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
    // Enhanced flexible fields
    definitions?: Array<{ term: string; meaning: string; source?: string }>
    referencedDocuments?: Array<{ name: string; description?: string }>
    additionalData?: Record<string, unknown>
    rawSections?: Record<string, string>
  }
}

export function OverviewArtifact({ data, className, isLoading }: OverviewArtifactProps) {
  const [copiedTerm, setCopiedTerm] = useState<string | null>(null);
  const [showRawSections, setShowRawSections] = useState(false);
  
  const copyTerm = (term: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedTerm(term);
    toast.success('Copied!');
    setTimeout(() => setCopiedTerm(null), 2000);
  };

  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with confidence */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">
            {data.title || 'Contract Overview'}
          </h3>
          {data.contractType && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded font-medium">
              {data.contractType}
            </span>
          )}
        </div>
        {data.confidence && (
          <ConfidenceIndicator value={data.confidence} size="sm" />
        )}
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-600 leading-relaxed break-words">{unwrapString(data.summary)}</p>
        </div>
      )}
      
      {/* Parties */}
      {data.parties && data.parties.length > 0 && (
        <ExpandableSection 
          title="Parties" 
          icon={Users}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.parties.length}</span>}
          defaultOpen
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.parties.map((party, i) => (
              <div 
                key={`${unwrapString(party.name) || unwrapString((party as any).legalName)}-${unwrapString(party.role)}`}
                className="px-2.5 py-2 bg-white rounded border border-slate-100 hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded font-medium">
                    {unwrapString(party.role) || 'Party'}
                  </span>
                  <span className="text-xs font-medium text-slate-700">{unwrapString(party.name) || unwrapString((party as any).legalName)}</span>
                </div>
                {party.email && (
                  <p className="text-[10px] text-slate-400 mt-1">{unwrapString(party.email)}</p>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
      
      {/* Key Dates */}
      {data.dates && (
        <ExpandableSection title="Dates" icon={Calendar} defaultOpen>
          <div className="flex flex-wrap gap-2">
            {data.dates.effective && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-violet-50 border border-violet-100 rounded">
                <span className="text-[10px] text-violet-600 font-medium">Effective</span>
                <span className="text-xs font-semibold text-violet-700">{formatDate(data.dates.effective)}</span>
              </div>
            )}
            {data.dates.signed && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-violet-50 border border-violet-100 rounded">
                <span className="text-[10px] text-violet-600 font-medium">Signed</span>
                <span className="text-xs font-semibold text-violet-700">{formatDate(data.dates.signed)}</span>
              </div>
            )}
            {data.dates.expiration && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-100 rounded">
                <span className="text-[10px] text-amber-600 font-medium">Expires</span>
                <span className="text-xs font-semibold text-amber-700">{formatDate(data.dates.expiration)}</span>
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
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.keyTerms.length}</span>}
        >
          <div className="space-y-1">
            {data.keyTerms.map((item, i) => (
              <div 
                key={item.term}
                className="flex items-center justify-between px-2 py-1.5 bg-slate-50/50 rounded hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] text-slate-400 shrink-0">{item.term}</span>
                  <span className="text-xs font-medium text-slate-700 truncate">{item.value}</span>
                </div>
                <button
                  onClick={() => copyTerm(item.term, item.value)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-200 rounded"
                >
                  {copiedTerm === item.term ? (
                    <Check className="h-3 w-3 text-violet-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Contract Definitions */}
      {data.definitions && data.definitions.length > 0 && (
        <ExpandableSection 
          title="Definitions" 
          icon={FileText}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.definitions.length}</span>}
        >
          <div className="space-y-2">
            {data.definitions.map((def, i) => (
              <div 
                key={def.term}
                className="px-2.5 py-2 bg-violet-50/50 rounded border border-indigo-100"
              >
                <span className="text-xs font-medium text-violet-700">&ldquo;{def.term}&rdquo;</span>
                <p className="mt-0.5 text-[10px] text-slate-600">{def.meaning}</p>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Referenced Documents / Schedules / Exhibits */}
      {data.referencedDocuments && data.referencedDocuments.length > 0 && (
        <ExpandableSection 
          title="References" 
          icon={ExternalLink}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.referencedDocuments.length}</span>}
        >
          <div className="space-y-1">
            {data.referencedDocuments.map((doc, i) => (
              <div 
                key={doc.name}
                className="flex items-center gap-2 px-2 py-1.5 bg-slate-50/50 rounded"
              >
                <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="text-xs font-medium text-slate-700">{doc.name}</span>
                {doc.description && (
                  <span className="text-[10px] text-slate-400">— {doc.description}</span>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Additional Data (dynamic/contextual) */}
      {data.additionalData && Object.keys(data.additionalData).length > 0 && (
        <ExpandableSection 
          title="Additional Information" 
          icon={Sparkles}
          badge={<Badge className="ml-2 text-[10px] bg-violet-100 text-violet-700">AI Extracted</Badge>}
        >
          <div className="space-y-2">
            {Object.entries(data.additionalData).map(([key, value], i) => {
              const displayValue = typeof value === 'object' && value !== null 
                ? (value as { value?: string }).value || JSON.stringify(value)
                : String(value);
              return (
                <div 
                  key={key}
                  className="flex items-start gap-3 p-3 bg-violet-50/50 rounded-lg"
                >
                  <span className="text-sm text-violet-600 font-medium capitalize shrink-0">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="text-sm text-slate-700">{displayValue}</span>
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Raw Sections (verbatim text) */}
      {data.rawSections && Object.keys(data.rawSections).length > 0 && (
        <ExpandableSection 
          title="Original Document Sections" 
          icon={Edit3}
          badge={<Badge className="ml-2 text-[10px] bg-slate-100 text-slate-600">Verbatim</Badge>}
        >
          <div className="space-y-4">
            {Object.entries(data.rawSections).map(([section, text], i) => (
              <div key={section} className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200">
                  <span className="text-sm font-medium text-slate-700">{section}</span>
                </div>
                <pre className="p-3 text-xs text-slate-600 whitespace-pre-wrap font-mono bg-slate-50 max-h-48 overflow-y-auto">
                  {text}
                </pre>
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
    // Enhanced flexible fields
    missingClauses?: string[]
    customClauseTypes?: string[]
    referencedExhibits?: Array<{ name: string; referencedInClause?: string; purpose?: string }>
    clauseHierarchy?: Record<string, string[]>
  }
  onClauseUpdate?: (clauseId: string, updates: Partial<Clause>) => void
  editable?: boolean
}

export function ClausesArtifact({ data, className, isLoading, onClauseUpdate, editable = false }: ClausesArtifactProps) {
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
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

  const startEditing = (clause: Clause) => {
    setEditingClauseId(clause.id);
    setEditContent(clause.content);
  };

  const saveEdit = (clauseId: string) => {
    if (onClauseUpdate && editContent.trim()) {
      onClauseUpdate(clauseId, { content: editContent });
    }
    setEditingClauseId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingClauseId(null);
    setEditContent('');
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
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Clauses</h3>
          <span className="text-[10px] text-slate-400">
            {data.totalCount || data.clauses.length} found
          </span>
        </div>
        
        {/* Filter Pills */}
        <div className="flex gap-0.5 p-0.5 bg-slate-100 rounded-md">
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded transition-all",
                filter === f 
                  ? "bg-white text-slate-700 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && importanceCounts[f] > 0 && (
                <span className="ml-0.5 text-slate-400">
                  {importanceCounts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* Clauses List */}
      <div className="space-y-2">
        {filteredClauses.map((clause) => {
          const isExpanded = expandedClauses.has(clause.id);
          
          return (
            <motion.div
              key={clause.id}
              layout
              className={cn(
                "border rounded-lg overflow-hidden transition-colors",
                isExpanded ? "border-indigo-200 bg-violet-50/30" : "border-slate-100 bg-white hover:border-slate-200"
              )}
            >
              <button
                onClick={() => toggleClause(clause.id)}
                className="w-full px-3 py-2.5 flex items-start gap-2 text-left"
              >
                <ImportanceDot importance={clause.importance} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-800">{clause.title}</span>
                    <span className="text-[10px] px-1 py-0.5 bg-slate-100 text-slate-500 rounded">
                      {clause.type}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {clause.content}
                    </p>
                  )}
                </div>
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 mt-0.5",
                  isExpanded && "rotate-90"
                )} />
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div key="expanded"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100"
                  >
                    <div className="px-3 py-2.5 space-y-3">
                      {/* Editable Content */}
                      {editingClauseId === clause.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full min-h-[80px] p-2 text-xs border border-indigo-200 rounded focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none resize-y"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={cancelEdit}
                              className="px-2 py-1 text-[10px] text-slate-500 hover:bg-slate-100 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(clause.id)}
                              className="px-2 py-1 text-[10px] bg-violet-600 text-white rounded hover:bg-violet-700 flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {clause.content}
                          </p>
                          {editable && (
                            <button
                              onClick={() => startEditing(clause)}
                              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white border border-slate-200 rounded shadow-sm hover:bg-slate-50"
                            >
                              <Edit3 className="h-3 w-3 text-slate-400" />
                            </button>
                          )}
                        </div>
                      )}
                      
                      {clause.obligations && clause.obligations.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                            Obligations
                          </h5>
                          <ul className="space-y-0.5">
                            {clause.obligations.map((ob, i) => (
                              <li key={ob} className="flex items-start gap-1.5 text-[10px] text-slate-600">
                                <CheckCircle2 className="h-3 w-3 text-violet-500 shrink-0 mt-0.5" />
                                <span className="break-words">{ob}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {clause.risks && clause.risks.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                            Risks
                          </h5>
                          <ul className="space-y-0.5">
                            {clause.risks.map((risk, i) => (
                              <li key={risk} className="flex items-start gap-1.5 text-[10px] text-slate-600 break-words">
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                <span className="break-words">{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Cross References */}
                      {clause.crossReferences && clause.crossReferences.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                            Cross References
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {clause.crossReferences.map((ref, i) => (
                              <span key={`${ref.from}-${ref.to}`} className="inline-flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50 rounded px-1.5 py-0.5">
                                <span className="font-mono">{ref.from}</span>
                                <ChevronRight className="h-2.5 w-2.5" />
                                <span className="font-mono">{ref.to}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Defined Terms Used */}
                      {clause.definedTermsUsed && clause.definedTermsUsed.length > 0 && (
                        <div>
                          <h5 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                            Defined Terms
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {clause.definedTermsUsed.map((term, i) => (
                              <Badge key={term} variant="outline" className="text-[10px] border-violet-200 text-violet-600">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subclauses */}
                      {clause.subclauses && clause.subclauses.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Subclauses
                          </h5>
                          <div className="space-y-2 ml-4 border-l-2 border-slate-200 pl-4">
                            {clause.subclauses.map((sub, i) => (
                              <div key={sub.id} className="text-sm">
                                <div className="flex items-center gap-2">
                                  {sub.sectionNumber && (
                                    <span className="font-mono text-xs text-slate-500">{sub.sectionNumber}</span>
                                  )}
                                  {sub.title && (
                                    <span className="font-medium text-slate-700">{sub.title}</span>
                                  )}
                                </div>
                                <p className="text-slate-600 mt-1">{sub.content}</p>
                                {sub.subItems && sub.subItems.length > 0 && (
                                  <ul className="mt-1 ml-4 list-disc list-inside text-xs text-slate-500">
                                    {sub.subItems.map((item, j) => (
                                      <li key={j}>{item}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw Clause Text (verbatim) */}
                      {clause.rawClauseText && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                            Original Text
                            <Badge className="text-[9px] bg-slate-100 text-slate-500">Verbatim</Badge>
                          </h5>
                          <pre className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                            {clause.rawClauseText}
                          </pre>
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

      {/* Missing Standard Clauses */}
      {data.missingClauses && data.missingClauses.length > 0 && (
        <ExpandableSection 
          title="Missing Standard Clauses" 
          icon={AlertTriangle}
          badge={<Badge className="ml-2 text-[10px] bg-amber-100 text-amber-700">{data.missingClauses.length}</Badge>}
        >
          <div className="space-y-2">
            {data.missingClauses.map((clause, i) => (
              <div key={clause} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {clause}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Referenced Exhibits */}
      {data.referencedExhibits && data.referencedExhibits.length > 0 && (
        <ExpandableSection 
          title="Referenced Exhibits & Schedules" 
          icon={ExternalLink}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.referencedExhibits.length}</Badge>}
        >
          <div className="space-y-2">
            {data.referencedExhibits.map((exhibit, i) => (
              <div key={exhibit.name} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">{exhibit.name}</span>
                  {exhibit.purpose && (
                    <span className="text-slate-500 ml-2">— {exhibit.purpose}</span>
                  )}
                  {exhibit.referencedInClause && (
                    <span className="text-xs text-slate-400 ml-2">(Ref: {exhibit.referencedInClause})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Custom Clause Types */}
      {data.customClauseTypes && data.customClauseTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          <span className="text-xs text-slate-500">Custom clause types in this contract:</span>
          {data.customClauseTypes.map((type, i) => (
            <Badge key={type} className="text-[10px] bg-violet-100 text-violet-700">
              {type}
            </Badge>
          ))}
        </div>
      )}
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
      critical: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
      high: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
      medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
      low: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' }
    };
    return configs[level as keyof typeof configs] || configs.medium;
  };

  const levelConfig = getRiskLevelConfig(data.riskLevel);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreRing 
            score={data.overallScore} 
            size="sm"
            label="Risk"
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Risk Assessment</h3>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", levelConfig.bg, levelConfig.text)}>
              {data.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <span className="text-[10px] text-slate-400">Factors</span>
          <p className="text-sm font-bold text-slate-700">{data.factors.length}</p>
        </div>
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className={cn(
          "px-3 py-2 rounded border",
          levelConfig.bg,
          levelConfig.border
        )}>
          <p className="text-xs text-slate-600">{unwrapString(data.summary)}</p>
        </div>
      )}
      
      {/* Risk Factors */}
      <div className="space-y-2">
        {data.factors.map((factor) => (
          <ExpandableSection
            key={factor.id}
            title={factor.category}
            badge={<SeverityBadge severity={factor.severity} />}
          >
            <div className="space-y-2">
              <p className="text-xs text-slate-600">{factor.description}</p>
              
              {factor.mitigation && (
                <div className="px-2 py-1.5 bg-violet-50 rounded border border-violet-100">
                  <h5 className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-0.5">
                    Mitigation
                  </h5>
                  <p className="text-xs text-violet-700">{factor.mitigation}</p>
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

// Dynamic row type - can have any keys matching the table headers
interface FinancialTableRow {
  [key: string]: string | number | undefined;
}

interface FinancialTable {
  tableName?: string;
  source?: string;
  headers?: string[];
  rows?: FinancialTableRow[];
  rawRows?: string[][];  // For 1:1 reproduction of table
  subtotals?: Array<{ label: string; amount: number; source?: string; extractedFromText?: boolean }>;
  grandTotal?: { amount: number; source?: string; extractedFromText?: boolean };
  notes?: string;
  extractedFromText?: boolean;
}

interface OfferLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

interface Offer {
  offerName?: string;
  validityPeriod?: string;
  validitySource?: string;
  totalAmount?: number;
  lineItems?: OfferLineItem[];
  terms?: string[];
  extractedFromText?: boolean;
}

interface CostBreakdownItem {
  category: string;
  amount: number;
  description?: string;
  source?: string;
}

interface Discount {
  type: string;
  value: number;
  unit: 'percentage' | 'fixed';
  description?: string;
  source?: string;
}

interface Penalty {
  type: string;
  amount: number;
  description?: string;
  trigger?: string;
  source?: string;
}

interface FinancialArtifactProps extends ArtifactBaseProps {
  data: {
    totalValue?: number | { value: number; source?: string; extractedFromText?: boolean };
    currency?: string | { value: string; source?: string; extractedFromText?: boolean };
    paymentTerms?: string | Array<string | { value: string; source?: string; extractedFromText?: boolean }>;
    paymentSchedule?: Array<{
      milestone?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
      year?: number;
    }>;
    yearlyBreakdown?: Array<{
      year: number;
      label: string;
      payments: Array<{ description: string; amount: number; dueDate?: string }>;
      subtotal: number;
    }>;
    rates?: RateCard[];
    costBreakdown?: CostBreakdownItem[];
    financialTables?: FinancialTable[];
    offers?: Offer[];
    discounts?: Discount[];
    penalties?: Penalty[];
    paymentMethod?: string;
    invoicingRequirements?: string;
    summary?: string;
    analysis?: string;
  }
}

export function FinancialArtifact({ data, className, isLoading }: FinancialArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  // Helper to get total value from either format
  const getTotalValue = (): number | undefined => {
    if (typeof data.totalValue === 'object' && data.totalValue?.value) {
      return data.totalValue.value;
    }
    return typeof data.totalValue === 'number' ? data.totalValue : undefined;
  };

  // Helper to get currency as string
  const getCurrency = (): string => {
    if (typeof data.currency === 'object' && data.currency?.value) {
      return data.currency.value;
    }
    return typeof data.currency === 'string' ? data.currency : 'USD';
  };

  const totalValue = getTotalValue();
  const currency = getCurrency();

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Financial</h3>
        {totalValue && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Total</span>
            <span className="text-sm font-bold text-violet-700 bg-violet-50 px-2 py-1 rounded">
              {formatCurrency(totalValue, currency)}
            </span>
          </div>
        )}
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-violet-100">
          <p className="text-xs text-slate-600">{unwrapString(data.summary)}</p>
        </div>
      )}
      
      {/* Payment Terms */}
      {data.paymentTerms && (
        <div className="px-3 py-2 bg-slate-50 rounded border border-slate-100">
          <h4 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Payment Terms</h4>
          {Array.isArray(data.paymentTerms) ? (
            <ul className="space-y-0.5">
              {data.paymentTerms.map((term, i) => (
                <li key={typeof term === 'object' ? term.value : term} className="text-xs text-slate-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-violet-500" />
                  {typeof term === 'object' ? term.value : term}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">{data.paymentTerms}</p>
          )}
        </div>
      )}

      {/* Yearly Payment Breakdown */}
      {data.yearlyBreakdown && data.yearlyBreakdown.length > 0 && (
        <ExpandableSection 
          title="Payment Schedule" 
          icon={Calendar}
          badge={<span className="ml-1 text-[10px] text-violet-600">{data.yearlyBreakdown.length}yr</span>}
          defaultOpen
        >
          <div className="space-y-2">
            {data.yearlyBreakdown.map((yearData, yearIdx) => (
              <div key={yearIdx} className="border border-violet-100 rounded overflow-hidden">
                <div className="bg-violet-50/50 px-2.5 py-1.5 border-b border-violet-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-[10px]">
                      {yearData.year}
                    </span>
                    <span className="text-xs font-medium text-violet-800">{yearData.label}</span>
                  </div>
                  <span className="text-xs font-bold text-violet-700">
                    {formatCurrency(yearData.subtotal, currency)}
                  </span>
                </div>
                
                {yearData.payments && yearData.payments.length > 0 && (
                  <div className="p-2 space-y-1">
                    {yearData.payments.map((payment, paymentIdx) => (
                      <div 
                        key={paymentIdx} 
                        className="flex items-center justify-between px-2 py-1.5 bg-white rounded border border-violet-50 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-medium">
                            {paymentIdx + 1}
                          </span>
                          <div>
                            <span className="font-medium text-slate-700">{payment.description}</span>
                            {payment.dueDate && (
                              <span className="text-[10px] text-slate-400 ml-2">Due: {payment.dueDate}</span>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold text-slate-700">
                          {formatCurrency(payment.amount, currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Grand Total */}
            {data.yearlyBreakdown.length > 1 && (
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200">
                <span className="font-semibold text-violet-800">Total Contract Value</span>
                <span className="text-xl font-bold text-violet-700">
                  {formatCurrency(
                    data.yearlyBreakdown.reduce((sum, y) => sum + (y.subtotal || 0), 0),
                    currency
                  )}
                </span>
              </div>
            )}
          </div>
        </ExpandableSection>
      )}

      {/* Payment Schedule (legacy flat format) */}
      {data.paymentSchedule && data.paymentSchedule.length > 0 && !data.yearlyBreakdown && (
        <ExpandableSection 
          title="Payment Schedule" 
          icon={Calendar}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.paymentSchedule.length} milestones</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {data.paymentSchedule.map((payment, i) => (
              <div key={`${payment.milestone || payment.description}-${payment.dueDate || ''}`} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900">{payment.milestone || payment.description}</p>
                  {payment.dueDate && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {payment.dueDate}
                    </p>
                  )}
                </div>
                <span className="font-semibold text-slate-900">
                  {payment.amount ? formatCurrency(payment.amount, currency) : '-'}
                </span>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Cost Breakdown */}
      {data.costBreakdown && data.costBreakdown.length > 0 && (
        <ExpandableSection 
          title="Cost Breakdown" 
          icon={TrendingUp}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.costBreakdown.length} items</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {data.costBreakdown.map((cost, i) => (
              <div key={cost.category} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-900">{cost.category}</p>
                  {cost.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{cost.description}</p>
                  )}
                </div>
                <p className="font-semibold text-slate-900">
                  {formatCurrency(cost.amount, currency)}
                </p>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Financial Tables */}
      {data.financialTables && data.financialTables.length > 0 && (
        <ExpandableSection 
          title="Financial Tables" 
          icon={FileText}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.financialTables.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-4">
            {data.financialTables.map((table, tableIdx) => {
              // Use headers from table or derive from first row keys
              const headers = table.headers || (table.rows?.[0] ? Object.keys(table.rows[0]) : []);
              const columnCount = headers.length || 1;
              
              return (
                <div key={tableIdx} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <h5 className="font-medium text-slate-700">{table.tableName || `Table ${tableIdx + 1}`}</h5>
                    {table.notes && (
                      <span className="text-xs text-slate-500 italic">{table.notes}</span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      {headers.length > 0 && (
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {headers.map((header, headerIdx) => (
                              <th 
                                key={headerIdx} 
                                className={cn(
                                  "py-2 px-4 font-medium text-slate-600",
                                  headerIdx === 0 ? "text-left" : "text-right"
                                )}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      )}
                      <tbody>
                        {/* Prefer rawRows for exact 1:1 reproduction, fallback to rows */}
                        {table.rawRows ? (
                          table.rawRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-slate-100 last:border-0">
                              {row.map((cell, cellIdx) => (
                                <td 
                                  key={cellIdx} 
                                  className={cn(
                                    "py-3 px-4",
                                    cellIdx === 0 ? "text-slate-900" : "text-right text-slate-600",
                                    cellIdx === row.length - 1 && "font-medium text-slate-900"
                                  )}
                                >
                                  {cell || '-'}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          table.rows?.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b border-slate-100 last:border-0">
                              {headers.map((header, cellIdx) => (
                                <td 
                                  key={cellIdx} 
                                  className={cn(
                                    "py-3 px-4",
                                    cellIdx === 0 ? "text-slate-900" : "text-right text-slate-600",
                                    cellIdx === headers.length - 1 && "font-medium text-slate-900"
                                  )}
                                >
                                  {row[header] ?? '-'}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                      {((table.subtotals && table.subtotals.length > 0) || table.grandTotal) && (
                        <tfoot className="bg-slate-50">
                          {table.subtotals?.map((sub, subIdx) => (
                            <tr key={subIdx} className="border-t border-slate-200">
                              <td colSpan={columnCount - 1} className="py-2 px-4 text-right font-medium text-slate-600">
                                {sub.label}:
                              </td>
                              <td className="py-2 px-4 text-right font-semibold text-slate-700">
                                {formatCurrency(sub.amount, currency)}
                              </td>
                            </tr>
                          ))}
                          {table.grandTotal && (
                            <tr className="border-t-2 border-slate-300">
                              <td colSpan={columnCount - 1} className="py-3 px-4 text-right font-bold text-slate-700">
                                Grand Total:
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-lg text-violet-600">
                                {formatCurrency(table.grandTotal.amount, currency)}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Offers / Quotes */}
      {data.offers && data.offers.length > 0 && (
        <ExpandableSection 
          title="Offers & Quotes" 
          icon={FileCheck}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.offers.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-4">
            {data.offers.map((offer, offerIdx) => (
              <div key={offerIdx} className="border border-violet-200 rounded-lg overflow-hidden bg-violet-50/30">
                <div className="bg-violet-50 px-4 py-3 border-b border-violet-200 flex items-center justify-between">
                  <h5 className="font-semibold text-violet-900">{offer.offerName || `Quote ${offerIdx + 1}`}</h5>
                  <div className="flex items-center gap-3">
                    {offer.validityPeriod && (
                      <Badge variant="outline" className="text-xs border-violet-300 text-violet-700">
                        Valid: {offer.validityPeriod}
                      </Badge>
                    )}
                    {offer.totalAmount && (
                      <span className="font-bold text-violet-900">
                        {formatCurrency(offer.totalAmount, currency)}
                      </span>
                    )}
                  </div>
                </div>
                
                {offer.lineItems && offer.lineItems.length > 0 && (
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-violet-200">
                          <th className="text-left py-2 font-medium text-slate-600">Item</th>
                          <th className="text-right py-2 font-medium text-slate-600">Qty</th>
                          <th className="text-right py-2 font-medium text-slate-600">Unit Price</th>
                          <th className="text-right py-2 font-medium text-slate-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offer.lineItems.map((item, itemIdx) => (
                          <tr key={itemIdx} className="border-b border-violet-100 last:border-0">
                            <td className="py-2 text-slate-900">{item.description}</td>
                            <td className="py-2 text-right text-slate-600">
                              {item.quantity} {item.unit || ''}
                            </td>
                            <td className="py-2 text-right text-slate-600">
                              {formatCurrency(item.unitPrice, currency)}
                            </td>
                            <td className="py-2 text-right font-medium text-slate-900">
                              {formatCurrency(item.total, currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {offer.terms && offer.terms.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-xs font-medium text-slate-500 mb-1">Terms:</p>
                    <div className="flex flex-wrap gap-2">
                      {offer.terms.map((term, termIdx) => (
                        <Badge key={termIdx} variant="secondary" className="text-xs">
                          {term}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Discounts */}
      {data.discounts && data.discounts.length > 0 && (
        <ExpandableSection 
          title="Discounts" 
          icon={Tag}
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-green-100 text-green-700">{data.discounts.length}</Badge>}
        >
          <div className="space-y-2">
            {data.discounts.map((discount, i) => (
              <div key={`discount-${discount.type}-${discount.value}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="font-medium text-slate-900 capitalize">{discount.type?.replace(/_/g, ' ')}</p>
                  {discount.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{discount.description}</p>
                  )}
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-300">
                  {discount.unit === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value, currency)} off
                </Badge>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Penalties */}
      {data.penalties && data.penalties.length > 0 && (
        <ExpandableSection 
          title="Penalties" 
          icon={AlertTriangle}
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-rose-100 text-rose-700">{data.penalties.length}</Badge>}
        >
          <div className="space-y-2">
            {data.penalties.map((penalty, i) => (
              <div key={`penalty-${penalty.type}-${penalty.amount}`} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
                <div>
                  <p className="font-medium text-slate-900 capitalize">{penalty.type?.replace(/_/g, ' ')}</p>
                  {penalty.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{penalty.description}</p>
                  )}
                  {penalty.trigger && (
                    <p className="text-xs text-rose-600 mt-1">Trigger: {penalty.trigger}</p>
                  )}
                </div>
                <Badge className="bg-rose-100 text-rose-700 border-rose-300">
                  {formatCurrency(penalty.amount, currency)}
                </Badge>
              </div>
            ))}
          </div>
        </ExpandableSection>
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
      'compliant': { bg: 'bg-violet-50', text: 'text-violet-600', icon: CheckCircle2 },
      'non-compliant': { bg: 'bg-rose-50', text: 'text-rose-600', icon: AlertTriangle },
      'review-needed': { bg: 'bg-amber-50', text: 'text-amber-600', icon: Info }
    }[status];
  };

  const statusCounts = {
    compliant: data.issues.filter(i => i.status === 'compliant').length,
    'non-compliant': data.issues.filter(i => i.status === 'non-compliant').length,
    'review-needed': data.issues.filter(i => i.status === 'review-needed').length
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with Score */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreRing 
            score={data.score} 
            size="sm"
            label="Score"
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Compliance</h3>
            <span className="text-[10px] text-slate-400">
              {data.regulations?.length || 0} regulations
            </span>
          </div>
        </div>
        
        {/* Status Summary */}
        <div className="flex gap-1.5">
          <div className="text-center px-2 py-1 bg-violet-50 rounded border border-violet-100">
            <p className="text-sm font-bold text-violet-700">{statusCounts.compliant}</p>
            <p className="text-[8px] text-violet-600 uppercase">OK</p>
          </div>
          <div className="text-center px-2 py-1 bg-amber-50 rounded border border-amber-100">
            <p className="text-sm font-bold text-amber-700">{statusCounts['review-needed']}</p>
            <p className="text-[8px] text-amber-600 uppercase">Review</p>
          </div>
          <div className="text-center px-2 py-1 bg-rose-50 rounded border border-rose-100">
            <p className="text-sm font-bold text-rose-700">{statusCounts['non-compliant']}</p>
            <p className="text-[8px] text-rose-600 uppercase">Issues</p>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-violet-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}
      
      {/* Regulations */}
      {data.regulations && data.regulations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.regulations.map((reg, i) => (
            <span 
              key={reg} 
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-slate-100 rounded text-[10px] text-slate-600"
            >
              <Scale className="h-2.5 w-2.5" />
              {reg}
            </span>
          ))}
        </div>
      )}
      
      {/* Compliance Issues */}
      <div className="space-y-1.5">
        {data.issues.map((issue) => {
          const config = getStatusConfig(issue.status);
          const StatusIcon = config.icon;
          
          return (
            <div
              key={issue.id}
              className={cn(
                "px-2.5 py-2 rounded border",
                config.bg,
                "border-slate-100"
              )}
            >
              <div className="flex items-start gap-2">
                <StatusIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", config.text)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">{issue.regulation}</span>
                    <span className={cn("text-[10px] font-medium px-1 py-0.5 rounded", config.bg, config.text)}>
                      {issue.status.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 break-words">{issue.requirement}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============ OBLIGATIONS ARTIFACT ============

interface Obligation {
  id: string
  title: string
  party: string
  type: 'deliverable' | 'sla' | 'milestone' | 'reporting' | 'compliance' | 'other'
  description: string
  dueDate?: string
  recurring?: {
    frequency: string
    interval: number
  }
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue'
  slaCriteria?: {
    metric: string
    target: string | number
    unit?: string
  }
  penalty?: string
  sourceClause?: string
  confidence?: number
}

interface ObligationsArtifactProps extends ArtifactBaseProps {
  data: {
    obligations: Obligation[]
    milestones?: Array<{
      id: string
      name: string
      date: string
      deliverables: string[]
      status?: 'upcoming' | 'due' | 'completed' | 'missed'
    }>
    slaMetrics?: Array<{
      metric: string
      target: string | number
      currentValue?: string | number
      status?: 'met' | 'at-risk' | 'breached'
      penalty?: string
    }>
    summary?: string
  }
}

export function ObligationsArtifact({ data, className, isLoading }: ObligationsArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getObligationTypeConfig = (type: Obligation['type']) => {
    return {
      'deliverable': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Deliverable' },
      'sla': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'SLA' },
      'milestone': { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Milestone' },
      'reporting': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Reporting' },
      'compliance': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Compliance' },
      'other': { bg: 'bg-slate-50', text: 'text-slate-500', label: 'Other' }
    }[type] || { bg: 'bg-slate-50', text: 'text-slate-500', label: type };
  };

  const getStatusConfig = (status?: string) => {
    return {
      'pending': { bg: 'bg-slate-50', text: 'text-slate-500', icon: Calendar },
      'in-progress': { bg: 'bg-violet-50', text: 'text-violet-500', icon: TrendingUp },
      'completed': { bg: 'bg-violet-50', text: 'text-violet-500', icon: CheckCircle2 },
      'overdue': { bg: 'bg-rose-50', text: 'text-rose-500', icon: AlertTriangle },
      'upcoming': { bg: 'bg-amber-50', text: 'text-amber-500', icon: Calendar },
      'due': { bg: 'bg-orange-50', text: 'text-orange-500', icon: AlertTriangle },
      'missed': { bg: 'bg-rose-50', text: 'text-rose-500', icon: AlertTriangle },
      'met': { bg: 'bg-violet-50', text: 'text-violet-500', icon: CheckCircle2 },
      'at-risk': { bg: 'bg-amber-50', text: 'text-amber-500', icon: AlertTriangle },
      'breached': { bg: 'bg-rose-50', text: 'text-rose-500', icon: AlertTriangle }
    }[status || 'pending'] || { bg: 'bg-slate-50', text: 'text-slate-500', icon: Info };
  };

  const obligationsByParty = data.obligations.reduce((acc, obl) => {
    const party = obl.party || 'Unassigned';
    if (!acc[party]) acc[party] = [];
    acc[party].push(obl);
    return acc;
  }, {} as Record<string, Obligation[]>);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800">Obligations</h3>
          <span className="text-[10px] text-slate-400">
            {data.obligations.length} total • {data.milestones?.length || 0} milestones
          </span>
        </div>
        <div className="flex gap-1">
          <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">
            {data.obligations.filter(o => o.type === 'sla').length} SLAs
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">
            {data.obligations.filter(o => o.status === 'pending' || o.status === 'in-progress').length} Active
          </span>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-violet-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}

      {/* SLA Metrics */}
      {data.slaMetrics && data.slaMetrics.length > 0 && (
        <ExpandableSection
          title="SLA Metrics"
          icon={TrendingUp}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.slaMetrics.length}</span>}
          defaultOpen
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.slaMetrics.map((sla, i) => {
              const config = getStatusConfig(sla.status);
              const StatusIcon = config.icon;
              return (
                <div key={sla.metric} className={cn("px-2.5 py-2 rounded border", config.bg, "border-slate-100")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 break-words">{sla.metric}</span>
                    <StatusIcon className={cn("h-3 w-3 shrink-0 ml-1", config.text)} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {sla.target}
                  </p>
                  {sla.currentValue && (
                    <p className="text-[10px] text-slate-400">Current: {sla.currentValue}</p>
                  )}
                  {sla.penalty && (
                    <p className="text-[10px] text-rose-500 mt-0.5">Penalty: {sla.penalty}</p>
                  )}
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Milestones */}
      {data.milestones && data.milestones.length > 0 && (
        <ExpandableSection
          title="Milestones"
          icon={Calendar}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.milestones.length}</span>}
        >
          <div className="space-y-1.5">
            {data.milestones.map((milestone) => {
              const config = getStatusConfig(milestone.status);
              return (
                <div key={milestone.id} className={cn("px-2.5 py-2 rounded border", config.bg, "border-slate-100")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-medium text-slate-700">{milestone.name}</h4>
                      <span className={cn("text-[10px] px-1 py-0.5 rounded", config.bg, config.text)}>
                        {milestone.status || 'upcoming'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">{formatDate(milestone.date)}</span>
                  </div>
                  {milestone.deliverables.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {milestone.deliverables.map((d, i) => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-100 rounded text-slate-500">
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Obligations by Party */}
      {Object.entries(obligationsByParty).map(([party, obligations]) => (
        <ExpandableSection
          key={party}
          title={party}
          icon={Users}
          badge={<span className="ml-1 text-[10px] text-slate-400">{obligations.length}</span>}
          defaultOpen
        >
          <div className="space-y-1.5">
            {obligations.map((obl) => {
              const typeConfig = getObligationTypeConfig(obl.type);
              const statusConfig = getStatusConfig(obl.status);
              return (
                <div key={obl.id} className="px-2.5 py-2 bg-white rounded border border-slate-100 hover:border-slate-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("text-[10px] px-1 py-0.5 rounded", typeConfig.bg, typeConfig.text)}>
                          {typeConfig.label}
                        </span>
                        <h4 className="text-xs font-medium text-slate-700 truncate">{obl.title}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{obl.description}</p>
                      {obl.slaCriteria && (
                        <p className="text-[10px] text-violet-500 mt-0.5">
                          SLA: {obl.slaCriteria.metric} - {obl.slaCriteria.target}{obl.slaCriteria.unit || ''}
                        </p>
                      )}
                      {obl.penalty && (
                        <p className="text-[10px] text-rose-500">Penalty: {obl.penalty}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {obl.dueDate && (
                        <p className="text-[10px] text-slate-400">{formatDate(obl.dueDate)}</p>
                      )}
                      <span className={cn("text-[10px] px-1 py-0.5 rounded mt-0.5 inline-block", statusConfig.bg, statusConfig.text)}>
                        {obl.status || 'pending'}
                      </span>
                    </div>
                  </div>
                  {obl.confidence && obl.confidence < 90 && (
                    <div className="mt-1.5">
                      <ConfidenceIndicator value={obl.confidence} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      ))}
    </div>
  );
}

// ============ RENEWAL ARTIFACT ============

interface RenewalArtifactProps extends ArtifactBaseProps {
  data: {
    autoRenewal: boolean
    renewalTerms?: {
      renewalPeriod: string
      noticePeriodDays: number
      optOutDeadline?: string
    }
    terminationNotice?: {
      requiredDays: number
      format?: string
      recipientParty?: string
    }
    priceEscalation?: Array<{
      type: string
      percentage?: number
      index?: string
      cap?: number
      effectiveDate?: string
    }>
    optOutDeadlines?: Array<{
      date: string
      description: string
      daysRemaining?: number
    }>
    renewalAlerts?: Array<{
      type: 'warning' | 'critical' | 'info'
      message: string
      dueDate?: string
    }>
    currentTermEnd?: string
    renewalCount?: number
    summary?: string
  }
}

export function RenewalArtifact({ data, className, isLoading }: RenewalArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getAlertConfig = (type: 'warning' | 'critical' | 'info') => {
    return {
      'critical': { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200', icon: AlertTriangle },
      'warning': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: AlertTriangle },
      'info': { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', icon: Info }
    }[type];
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800">Renewal & Termination</h3>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", 
          data.autoRenewal ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'
        )}>
          {data.autoRenewal ? 'Auto-Renewal' : 'Manual'}
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-indigo-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}

      {/* Renewal Alerts */}
      {data.renewalAlerts && data.renewalAlerts.length > 0 && (
        <div className="space-y-1.5">
          {data.renewalAlerts.map((alert, i) => {
            const config = getAlertConfig(alert.type);
            const AlertIcon = config.icon;
            return (
              <div key={`${alert.type}-${alert.message}`} className={cn("px-2.5 py-2 rounded border", config.bg, config.border)}>
                <div className="flex items-start gap-2">
                  <AlertIcon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", config.text)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium", config.text)}>{alert.message}</p>
                    {alert.dueDate && (
                      <p className="text-[10px] text-slate-400 mt-0.5">Due: {formatDate(alert.dueDate)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Key Dates */}
      <div className="flex flex-wrap gap-2">
        {data.currentTermEnd && (
          <div className="px-2.5 py-2 bg-slate-50 rounded border border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase">Term Ends</p>
            <p className="text-sm font-bold text-slate-700">{formatDate(data.currentTermEnd)}</p>
          </div>
        )}
        {data.renewalTerms?.optOutDeadline && (
          <div className="px-2.5 py-2 bg-amber-50 rounded border border-amber-100">
            <p className="text-[10px] text-amber-500 uppercase">Opt-Out</p>
            <p className="text-sm font-bold text-amber-600">{formatDate(data.renewalTerms.optOutDeadline)}</p>
          </div>
        )}
        {data.terminationNotice && (
          <div className="px-2.5 py-2 bg-rose-50 rounded border border-rose-100">
            <p className="text-[10px] text-rose-500 uppercase">Notice</p>
            <p className="text-sm font-bold text-rose-600">{data.terminationNotice.requiredDays}d</p>
          </div>
        )}
        {data.renewalTerms && (
          <div className="px-2.5 py-2 bg-violet-50 rounded border border-indigo-100">
            <p className="text-[10px] text-violet-500 uppercase">Period</p>
            <p className="text-sm font-bold text-violet-600">{data.renewalTerms.renewalPeriod}</p>
          </div>
        )}
      </div>

      {/* Price Escalation */}
      {data.priceEscalation && data.priceEscalation.length > 0 && (
        <ExpandableSection
          title="Price Escalation"
          icon={TrendingUp}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.priceEscalation.length}</span>}
        >
          <div className="space-y-1.5">
            {data.priceEscalation.map((esc, i) => (
              <div key={`${esc.type}-${esc.effectiveDate || ''}`} className="px-2.5 py-2 bg-white rounded border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{esc.type}</span>
                  {esc.percentage && (
                    <span className="text-[10px] px-1 py-0.5 bg-amber-50 text-amber-600 rounded">+{esc.percentage}%</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {esc.index && <p className="text-[10px] text-slate-400">Index: {esc.index}</p>}
                  {esc.cap && <p className="text-[10px] text-slate-400">Cap: {esc.cap}%</p>}
                  {esc.effectiveDate && <p className="text-[10px] text-slate-400">{formatDate(esc.effectiveDate)}</p>}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Opt-Out Deadlines */}
      {data.optOutDeadlines && data.optOutDeadlines.length > 0 && (
        <ExpandableSection
          title="Opt-Out Deadlines"
          icon={AlertTriangle}
          badge={<span className="ml-1 text-[10px] text-amber-500">{data.optOutDeadlines.length}</span>}
          defaultOpen
        >
          <div className="space-y-1.5">
            {data.optOutDeadlines.map((deadline, i) => (
              <div key={`optout-${deadline.date}`} className="px-2.5 py-2 bg-amber-50 rounded border border-amber-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{formatDate(deadline.date)}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{deadline.description}</p>
                  </div>
                  {deadline.daysRemaining !== undefined && (
                    <span className={cn("text-[10px] px-1 py-0.5 rounded",
                      deadline.daysRemaining < 30 ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                    )}>
                      {deadline.daysRemaining}d
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ NEGOTIATION POINTS ARTIFACT ============

interface NegotiationPointsArtifactProps extends ArtifactBaseProps {
  data: {
    leveragePoints?: Array<{
      id: string
      title: string
      description: string
      category: string
      strength: 'strong' | 'moderate' | 'weak'
      suggestedAction?: string
      sourceClause?: string
    }>
    weakClauses?: Array<{
      id: string
      clauseReference: string
      issue: string
      impact: 'high' | 'medium' | 'low'
      suggestedRevision?: string
      benchmarkComparison?: string
    }>
    benchmarkGaps?: Array<{
      area: string
      currentTerm: string
      marketStandard: string
      gap: string
      recommendation: string
    }>
    negotiationScript?: Array<{
      topic: string
      openingPosition: string
      fallbackPosition: string
      walkAwayPoint?: string
      supportingEvidence?: string[]
    }>
    summary?: string
    overallLeverage?: 'strong' | 'balanced' | 'weak'
  }
}

export function NegotiationPointsArtifact({ data, className, isLoading }: NegotiationPointsArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getStrengthConfig = (strength: string) => {
    return {
      'strong': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Strong' },
      'moderate': { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Moderate' },
      'weak': { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Weak' },
      'balanced': { bg: 'bg-violet-50', text: 'text-violet-600', label: 'Balanced' }
    }[strength] || { bg: 'bg-slate-50', text: 'text-slate-500', label: strength };
  };

  const leverageConfig = getStrengthConfig(data.overallLeverage || 'balanced');

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800">Negotiation Intel</h3>
        </div>
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded", leverageConfig.bg, leverageConfig.text)}>
          {leverageConfig.label}
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-violet-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}

      {/* Leverage Points */}
      {data.leveragePoints && data.leveragePoints.length > 0 && (
        <ExpandableSection
          title="Leverage Points"
          icon={TrendingUp}
          badge={<span className="ml-1 text-[10px] text-violet-500">{data.leveragePoints.length}</span>}
          defaultOpen
        >
          <div className="space-y-1.5">
            {data.leveragePoints.map((point) => {
              const strengthConfig = getStrengthConfig(point.strength);
              return (
                <div key={point.id} className="px-2.5 py-2 bg-white rounded border border-slate-100 hover:border-violet-200 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={cn("text-[10px] px-1 py-0.5 rounded", strengthConfig.bg, strengthConfig.text)}>
                      {strengthConfig.label}
                    </span>
                    <span className="text-[10px] px-1 py-0.5 bg-slate-50 text-slate-500 rounded">{point.category}</span>
                  </div>
                  <h4 className="text-xs font-medium text-slate-700">{point.title}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5">{point.description}</p>
                  {point.suggestedAction && (
                    <p className="text-[10px] text-violet-600 mt-1 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      {point.suggestedAction}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ExpandableSection>
      )}

      {/* Weak Clauses */}
      {data.weakClauses && data.weakClauses.length > 0 && (
        <ExpandableSection
          title="Weak Clauses"
          icon={AlertTriangle}
          badge={<span className="ml-1 text-[10px] text-rose-500">{data.weakClauses.length}</span>}
        >
          <div className="space-y-1.5">
            {data.weakClauses.map((clause) => (
              <div key={clause.id} className="px-2.5 py-2 bg-rose-50/50 rounded border border-rose-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] px-1 py-0.5 bg-white border border-slate-100 text-slate-500 rounded">{clause.clauseReference}</span>
                  <SeverityBadge severity={clause.impact} />
                </div>
                <p className="text-xs font-medium text-slate-700">{clause.issue}</p>
                {clause.suggestedRevision && (
                  <div className="mt-1.5 px-2 py-1.5 bg-white rounded border border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase mb-0.5">Suggested</p>
                    <p className="text-[10px] text-slate-600">{clause.suggestedRevision}</p>
                  </div>
                )}
                {clause.benchmarkComparison && (
                  <p className="text-[10px] text-slate-400 mt-1">Market: {clause.benchmarkComparison}</p>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Benchmark Gaps */}
      {data.benchmarkGaps && data.benchmarkGaps.length > 0 && (
        <ExpandableSection
          title="Benchmark Gaps"
          icon={TrendingDown}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.benchmarkGaps.length}</span>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1.5 font-medium text-slate-500">Area</th>
                  <th className="text-left py-1.5 font-medium text-slate-500">Current</th>
                  <th className="text-left py-1.5 font-medium text-slate-500">Market</th>
                  <th className="text-left py-1.5 font-medium text-slate-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.benchmarkGaps.map((gap, i) => (
                  <tr key={gap.area} className="border-b border-slate-50 last:border-0">
                    <td className="py-1.5 text-slate-700 font-medium">{gap.area}</td>
                    <td className="py-1.5 text-rose-500">{gap.currentTerm}</td>
                    <td className="py-1.5 text-violet-500">{gap.marketStandard}</td>
                    <td className="py-1.5 text-slate-500">{gap.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ExpandableSection>
      )}

      {/* Negotiation Script */}
      {data.negotiationScript && data.negotiationScript.length > 0 && (
        <ExpandableSection
          title="Negotiation Script"
          icon={Edit3}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.negotiationScript.length}</span>}
        >
          <div className="space-y-2">
            {data.negotiationScript.map((script, i) => (
              <div key={script.topic} className="px-2.5 py-2 bg-white rounded border border-slate-100">
                <h4 className="text-xs font-medium text-slate-700">{script.topic}</h4>
                <div className="mt-1.5 space-y-1">
                  <div className="px-2 py-1 bg-violet-50 rounded">
                    <p className="text-[10px] text-violet-600">{script.openingPosition}</p>
                  </div>
                  <div className="px-2 py-1 bg-amber-50 rounded">
                    <p className="text-[10px] text-amber-600">{script.fallbackPosition}</p>
                  </div>
                  {script.walkAwayPoint && (
                    <div className="px-2 py-1 bg-rose-50 rounded">
                      <p className="text-[10px] text-rose-600">{script.walkAwayPoint}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ AMENDMENTS ARTIFACT ============

interface AmendmentsArtifactProps extends ArtifactBaseProps {
  data: {
    amendments?: Array<{
      id: string
      amendmentNumber: number
      effectiveDate: string
      title: string
      description: string
      changedClauses: Array<{
        clauseId: string
        originalText?: string
        newText: string
        changeType: 'added' | 'modified' | 'deleted'
      }>
      signedBy?: string[]
      sourceDocument?: string
    }>
    supersededClauses?: Array<{
      originalClause: string
      supersededBy: string
      effectiveDate: string
    }>
    changeLog?: Array<{
      date: string
      type: string
      description: string
      reference?: string
    }>
    consolidatedTerms?: {
      lastUpdated: string
      version: string
      effectiveTerms: string[]
    }
    summary?: string
  }
}

export function AmendmentsArtifact({ data, className, isLoading }: AmendmentsArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const getChangeTypeConfig = (type: string) => {
    return {
      'added': { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Added' },
      'modified': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Modified' },
      'deleted': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Deleted' }
    }[type] || { bg: 'bg-slate-100', text: 'text-slate-600', label: type };
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-slate-800">Amendments</h3>
          <span className="text-[10px] text-slate-400">{data.amendments?.length || 0} tracked</span>
        </div>
        {data.consolidatedTerms && (
          <span className="text-[10px] px-1.5 py-0.5 bg-violet-50 text-violet-600 rounded">
            v{data.consolidatedTerms.version}
          </span>
        )}
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-indigo-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}

      {/* Amendments */}
      {data.amendments && data.amendments.length > 0 && (
        <ExpandableSection
          title="Amendments"
          icon={FileText}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.amendments.length}</span>}
          defaultOpen
        >
          <div className="space-y-2">
            {data.amendments.map((amendment) => (
              <div key={amendment.id} className="px-2.5 py-2 bg-white rounded border border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1 py-0.5 bg-violet-50 text-violet-600 rounded">
                    #{amendment.amendmentNumber}
                  </span>
                  <span className="text-xs font-medium text-slate-700 truncate">{amendment.title}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{formatDate(amendment.effectiveDate)}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{amendment.description}</p>
                
                {/* Changed Clauses */}
                {amendment.changedClauses.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {amendment.changedClauses.map((clause, i) => {
                      const config = getChangeTypeConfig(clause.changeType);
                      return (
                        <div key={clause.clauseId} className={cn("px-2 py-1.5 rounded", config.bg)}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">{clause.clauseId}</span>
                            <span className={cn("text-[10px] px-1 py-0.5 rounded", config.bg, config.text)}>
                              {config.label}
                            </span>
                          </div>
                          {clause.originalText && (
                            <p className="text-[10px] text-slate-400 line-through mt-0.5">{clause.originalText}</p>
                          )}
                          <p className="text-[10px] text-slate-700">{clause.newText}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Signed By */}
                {amendment.signedBy && amendment.signedBy.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Users className="h-2.5 w-2.5 text-slate-400" />
                    <span className="text-[10px] text-slate-400">
                      {amendment.signedBy.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Change Log */}
      {data.changeLog && data.changeLog.length > 0 && (
        <ExpandableSection
          title="Change Log"
          icon={Calendar}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.changeLog.length}</span>}
        >
          <div className="relative">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-slate-100" />
            <div className="space-y-1.5">
              {data.changeLog.map((entry, i) => (
                <div key={`${entry.type}-${entry.date}`} className="relative pl-6">
                  <div className="absolute left-0.5 w-2 h-2 rounded-full bg-white border border-indigo-400" />
                  <div className="px-2 py-1.5 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-1 py-0.5 bg-white border border-slate-100 text-slate-500 rounded">{entry.type}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(entry.date)}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">{entry.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExpandableSection>
      )}

      {/* Superseded Clauses */}
      {data.supersededClauses && data.supersededClauses.length > 0 && (
        <ExpandableSection
          title="Superseded Clauses"
          icon={FileText}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.supersededClauses.length}</span>}
        >
          <div className="space-y-1">
            {data.supersededClauses.map((clause, i) => (
              <div key={clause.originalClause} className="px-2 py-1.5 bg-slate-50 rounded border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400 line-through">{clause.originalClause}</span>
                  <span className="text-slate-300">→</span>
                  <span className="text-slate-600 font-medium">{clause.supersededBy}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(clause.effectiveDate)}</p>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ CONTACTS ARTIFACT ============

interface ContactsArtifactProps extends ArtifactBaseProps {
  data: {
    primaryContacts?: Array<{
      id: string
      name: string
      role: string
      party: string
      email?: string
      phone?: string
      address?: string
      isPrimary?: boolean
    }>
    escalationPath?: Array<{
      level: number
      role: string
      name?: string
      contactInfo?: string
      escalationTrigger?: string
    }>
    notificationAddresses?: Array<{
      purpose: string
      party: string
      address: string
      format?: string
    }>
    keyPersonnel?: Array<{
      name: string
      role: string
      responsibilities: string[]
      party: string
    }>
    summary?: string
  }
}

export function ContactsArtifact({ data, className, isLoading }: ContactsArtifactProps) {
  if (isLoading) {
    return <ArtifactSkeleton />;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-slate-800">Key Contacts</h3>
        <span className="text-[10px] text-slate-400">
          {data.primaryContacts?.length || 0} contacts • {data.escalationPath?.length || 0} levels
        </span>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="px-3 py-2 bg-violet-50/50 rounded border border-violet-100">
          <p className="text-xs text-slate-600 break-words">{unwrapString(data.summary)}</p>
        </div>
      )}

      {/* Primary Contacts */}
      {data.primaryContacts && data.primaryContacts.length > 0 && (
        <ExpandableSection
          title="Primary Contacts"
          icon={Users}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.primaryContacts.length}</span>}
          defaultOpen
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.primaryContacts.map((contact) => (
              <div key={contact.id} className="px-2.5 py-2 bg-white rounded border border-slate-100 hover:border-violet-200 transition-colors">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-medium text-slate-700">{contact.name}</h4>
                  {contact.isPrimary && (
                    <span className="text-[10px] px-1 py-0.5 bg-violet-50 text-violet-600 rounded">Primary</span>
                  )}
                  <span className="text-[10px] px-1 py-0.5 bg-slate-50 text-slate-500 rounded">{contact.party}</span>
                </div>
                <p className="text-[10px] text-slate-500">{contact.role}</p>
                
                <div className="mt-1.5 space-y-0.5">
                  {contact.email && (
                    <button
                      onClick={() => copyToClipboard(contact.email!)}
                      className="text-[10px] text-violet-500 hover:underline flex items-center gap-1"
                    >
                      {contact.email}
                      <Copy className="h-2.5 w-2.5" />
                    </button>
                  )}
                  {contact.phone && (
                    <p className="text-[10px] text-slate-500">{contact.phone}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Escalation Path */}
      {data.escalationPath && data.escalationPath.length > 0 && (
        <ExpandableSection
          title="Escalation Path"
          icon={TrendingUp}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.escalationPath.length}</span>}
        >
          <div className="relative">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-gradient-to-b from-violet-400 via-amber-400 to-rose-400" />
            <div className="space-y-1.5">
              {data.escalationPath.map((level, i) => (
                <div key={level.level} className="relative pl-6">
                  <div className="absolute left-0 w-4 h-4 rounded-full bg-white border border-indigo-400 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-violet-500">{level.level}</span>
                  </div>
                  <div className="px-2 py-1.5 bg-slate-50 rounded border border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-slate-700">{level.role}</h4>
                      {level.name && <span className="text-[10px] text-slate-500">{level.name}</span>}
                    </div>
                    {level.contactInfo && (
                      <p className="text-[10px] text-violet-500">{level.contactInfo}</p>
                    )}
                    {level.escalationTrigger && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Trigger: {level.escalationTrigger}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ExpandableSection>
      )}

      {/* Notification Addresses */}
      {data.notificationAddresses && data.notificationAddresses.length > 0 && (
        <ExpandableSection
          title="Notification Addresses"
          icon={FileText}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.notificationAddresses.length}</span>}
        >
          <div className="space-y-1.5">
            {data.notificationAddresses.map((addr, i) => (
              <div key={`${addr.party}-${addr.purpose}`} className="px-2.5 py-2 bg-white rounded border border-slate-100">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] px-1 py-0.5 bg-slate-50 text-slate-500 rounded">{addr.purpose}</span>
                    <p className="text-xs font-medium text-slate-700 mt-0.5">{addr.party}</p>
                    <p className="text-[10px] text-slate-500">{addr.address}</p>
                  </div>
                  {addr.format && (
                    <span className="text-[10px] px-1 py-0.5 bg-slate-50 text-slate-400 rounded">
                      {addr.format}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Key Personnel */}
      {data.keyPersonnel && data.keyPersonnel.length > 0 && (
        <ExpandableSection
          title="Key Personnel"
          icon={Users}
          badge={<span className="ml-1 text-[10px] text-slate-400">{data.keyPersonnel.length}</span>}
        >
          <div className="space-y-1.5">
            {data.keyPersonnel.map((person, i) => (
              <div key={`${person.name}-${person.role}`} className="px-2.5 py-2 bg-white rounded border border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-medium text-slate-700">{person.name}</h4>
                    <p className="text-[10px] text-slate-500">{person.role}</p>
                  </div>
                  <span className="text-[10px] px-1 py-0.5 bg-slate-50 text-slate-400 rounded">{person.party}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {person.responsibilities.map((resp, j) => (
                    <span key={j} className="text-[10px] px-1 py-0.5 bg-violet-50 text-violet-600 rounded">
                      {resp}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}

// ============ SKELETON ============

function ArtifactSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
        <div className="h-5 w-16 bg-slate-100 rounded" />
      </div>
      <div className="h-12 bg-slate-50 rounded border border-slate-100" />
      <div className="space-y-1.5">
        <div className="h-10 bg-slate-50 rounded border border-slate-100" />
        <div className="h-10 bg-slate-50 rounded border border-slate-100" />
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

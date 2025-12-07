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

      {/* Contract Definitions */}
      {data.definitions && data.definitions.length > 0 && (
        <ExpandableSection 
          title="Defined Terms" 
          icon={FileText}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.definitions.length}</Badge>}
        >
          <div className="space-y-3">
            {data.definitions.map((def, i) => (
              <div 
                key={i}
                className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100"
              >
                <div className="flex items-start gap-2">
                  <span className="font-medium text-indigo-700">"{def.term}"</span>
                  <span className="text-slate-600">means</span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{def.meaning}</p>
                {def.source && (
                  <p className="mt-1 text-xs text-slate-400">Source: {def.source}</p>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Referenced Documents / Schedules / Exhibits */}
      {data.referencedDocuments && data.referencedDocuments.length > 0 && (
        <ExpandableSection 
          title="Referenced Documents" 
          icon={ExternalLink}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.referencedDocuments.length}</Badge>}
        >
          <div className="space-y-2">
            {data.referencedDocuments.map((doc, i) => (
              <div 
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
              >
                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                <div>
                  <span className="font-medium text-slate-900">{doc.name}</span>
                  {doc.description && (
                    <span className="text-slate-500 ml-2">— {doc.description}</span>
                  )}
                </div>
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
          badge={<Badge className="ml-2 text-[10px] bg-purple-100 text-purple-700">AI Extracted</Badge>}
        >
          <div className="space-y-2">
            {Object.entries(data.additionalData).map(([key, value], i) => {
              const displayValue = typeof value === 'object' && value !== null 
                ? (value as { value?: string }).value || JSON.stringify(value)
                : String(value);
              return (
                <div 
                  key={i}
                  className="flex items-start gap-3 p-3 bg-purple-50/50 rounded-lg"
                >
                  <span className="text-sm text-purple-600 font-medium capitalize shrink-0">
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
              <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
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
                      {/* Editable Content */}
                      {editingClauseId === clause.id ? (
                        <div className="space-y-3">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full min-h-[120px] p-3 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => saveEdit(clause.id)}
                              className="bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <p className="text-sm text-slate-700 leading-relaxed">
                            {clause.content}
                          </p>
                          {editable && (
                            <button
                              onClick={() => startEditing(clause)}
                              className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-white border border-slate-200 rounded-md shadow-sm hover:bg-slate-50"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-slate-500" />
                            </button>
                          )}
                        </div>
                      )}
                      
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

                      {/* Cross References */}
                      {clause.crossReferences && clause.crossReferences.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Cross References
                          </h5>
                          <div className="space-y-1">
                            {clause.crossReferences.map((ref, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded px-2 py-1">
                                <span className="font-mono text-xs">{ref.from}</span>
                                <ChevronRight className="h-3 w-3" />
                                <span className="font-mono text-xs">{ref.to}</span>
                                {ref.context && <span className="text-slate-500 text-xs ml-2">({ref.context})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Defined Terms Used */}
                      {clause.definedTermsUsed && clause.definedTermsUsed.length > 0 && (
                        <div>
                          <h5 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                            Defined Terms Used
                          </h5>
                          <div className="flex flex-wrap gap-1">
                            {clause.definedTermsUsed.map((term, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] border-purple-200 text-purple-600">
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
                              <div key={i} className="text-sm">
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
              <div key={i} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
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
              <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
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
            <Badge key={i} className="text-[10px] bg-purple-100 text-purple-700">
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
    rates?: RateCard[];
    costBreakdown?: CostBreakdownItem[];
    financialTables?: FinancialTable[];
    offers?: Offer[];
    discounts?: Discount[];
    penalties?: Penalty[];
    summary?: string;
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
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Financial Analysis</h3>
        {totalValue && (
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Value</p>
            <p className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalValue, currency)}
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
          {Array.isArray(data.paymentTerms) ? (
            <ul className="space-y-1">
              {data.paymentTerms.map((term, i) => (
                <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {typeof term === 'object' ? term.value : term}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">{data.paymentTerms}</p>
          )}
        </div>
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
              <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
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
                              <td className="py-3 px-4 text-right font-bold text-lg text-emerald-600">
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
              <div key={offerIdx} className="border border-blue-200 rounded-lg overflow-hidden bg-blue-50/30">
                <div className="bg-blue-50 px-4 py-3 border-b border-blue-200 flex items-center justify-between">
                  <h5 className="font-semibold text-blue-900">{offer.offerName || `Quote ${offerIdx + 1}`}</h5>
                  <div className="flex items-center gap-3">
                    {offer.validityPeriod && (
                      <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
                        Valid: {offer.validityPeriod}
                      </Badge>
                    )}
                    {offer.totalAmount && (
                      <span className="font-bold text-blue-900">
                        {formatCurrency(offer.totalAmount, currency)}
                      </span>
                    )}
                  </div>
                </div>
                
                {offer.lineItems && offer.lineItems.length > 0 && (
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-blue-200">
                          <th className="text-left py-2 font-medium text-slate-600">Item</th>
                          <th className="text-right py-2 font-medium text-slate-600">Qty</th>
                          <th className="text-right py-2 font-medium text-slate-600">Unit Price</th>
                          <th className="text-right py-2 font-medium text-slate-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offer.lineItems.map((item, itemIdx) => (
                          <tr key={itemIdx} className="border-b border-blue-100 last:border-0">
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
              <div key={i} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
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
              <div key={i} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-200">
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
      'deliverable': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Deliverable' },
      'sla': { bg: 'bg-purple-100', text: 'text-purple-700', label: 'SLA' },
      'milestone': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Milestone' },
      'reporting': { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Reporting' },
      'compliance': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Compliance' },
      'other': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Other' }
    }[type] || { bg: 'bg-slate-100', text: 'text-slate-600', label: type };
  };

  const getStatusConfig = (status?: string) => {
    return {
      'pending': { bg: 'bg-slate-100', text: 'text-slate-600', icon: Calendar },
      'in-progress': { bg: 'bg-blue-100', text: 'text-blue-600', icon: TrendingUp },
      'completed': { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: CheckCircle2 },
      'overdue': { bg: 'bg-rose-100', text: 'text-rose-600', icon: AlertTriangle },
      'upcoming': { bg: 'bg-amber-100', text: 'text-amber-600', icon: Calendar },
      'due': { bg: 'bg-orange-100', text: 'text-orange-600', icon: AlertTriangle },
      'missed': { bg: 'bg-rose-100', text: 'text-rose-600', icon: AlertTriangle },
      'met': { bg: 'bg-emerald-100', text: 'text-emerald-600', icon: CheckCircle2 },
      'at-risk': { bg: 'bg-amber-100', text: 'text-amber-600', icon: AlertTriangle },
      'breached': { bg: 'bg-rose-100', text: 'text-rose-600', icon: AlertTriangle }
    }[status || 'pending'] || { bg: 'bg-slate-100', text: 'text-slate-600', icon: Info };
  };

  const obligationsByParty = data.obligations.reduce((acc, obl) => {
    const party = obl.party || 'Unassigned';
    if (!acc[party]) acc[party] = [];
    acc[party].push(obl);
    return acc;
  }, {} as Record<string, Obligation[]>);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-blue-500" />
            Obligations Tracker
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {data.obligations.length} obligations • {data.milestones?.length || 0} milestones
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-blue-100 text-blue-700">
            {data.obligations.filter(o => o.type === 'sla').length} SLAs
          </Badge>
          <Badge className="bg-amber-100 text-amber-700">
            {data.obligations.filter(o => o.status === 'pending' || o.status === 'in-progress').length} Active
          </Badge>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-xl border border-blue-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}

      {/* SLA Metrics */}
      {data.slaMetrics && data.slaMetrics.length > 0 && (
        <ExpandableSection
          title="SLA Metrics"
          icon={TrendingUp}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.slaMetrics.length}</Badge>}
          defaultOpen
        >
          <div className="grid grid-cols-2 gap-3">
            {data.slaMetrics.map((sla, i) => {
              const config = getStatusConfig(sla.status);
              const StatusIcon = config.icon;
              return (
                <div key={i} className={cn("p-3 rounded-lg border", config.bg, "border-slate-200/50")}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 text-sm">{sla.metric}</span>
                    <StatusIcon className={cn("h-4 w-4", config.text)} />
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    Target: {sla.target}
                  </p>
                  {sla.currentValue && (
                    <p className="text-xs text-slate-500">Current: {sla.currentValue}</p>
                  )}
                  {sla.penalty && (
                    <p className="text-xs text-rose-600 mt-1">Penalty: {sla.penalty}</p>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.milestones.length}</Badge>}
        >
          <div className="space-y-3">
            {data.milestones.map((milestone) => {
              const config = getStatusConfig(milestone.status);
              return (
                <div key={milestone.id} className={cn("p-4 rounded-xl border", config.bg, "border-slate-200/50")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-slate-900">{milestone.name}</h4>
                      <p className="text-sm text-slate-600 mt-1">{formatDate(milestone.date)}</p>
                    </div>
                    <Badge className={cn("text-[10px]", config.bg, config.text)}>
                      {milestone.status || 'upcoming'}
                    </Badge>
                  </div>
                  {milestone.deliverables.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {milestone.deliverables.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] bg-white">
                          {d}
                        </Badge>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{obligations.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {obligations.map((obl) => {
              const typeConfig = getObligationTypeConfig(obl.type);
              const statusConfig = getStatusConfig(obl.status);
              return (
                <div key={obl.id} className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px]", typeConfig.bg, typeConfig.text)}>
                          {typeConfig.label}
                        </Badge>
                        <h4 className="font-medium text-slate-900 text-sm">{obl.title}</h4>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{obl.description}</p>
                      {obl.slaCriteria && (
                        <p className="text-xs text-purple-600 mt-1">
                          SLA: {obl.slaCriteria.metric} - {obl.slaCriteria.target} {obl.slaCriteria.unit || ''}
                        </p>
                      )}
                      {obl.penalty && (
                        <p className="text-xs text-rose-600 mt-1">Penalty: {obl.penalty}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {obl.dueDate && (
                        <p className="text-xs text-slate-500">{formatDate(obl.dueDate)}</p>
                      )}
                      <Badge className={cn("text-[10px] mt-1", statusConfig.bg, statusConfig.text)}>
                        {obl.status || 'pending'}
                      </Badge>
                    </div>
                  </div>
                  {obl.confidence && obl.confidence < 90 && (
                    <div className="mt-2 flex items-center gap-2">
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
      'critical': { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', icon: AlertTriangle },
      'warning': { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', icon: AlertTriangle },
      'info': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', icon: Info }
    }[type];
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-indigo-500" />
            Renewal & Termination
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Contract renewal terms and deadlines
          </p>
        </div>
        <Badge className={data.autoRenewal ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}>
          {data.autoRenewal ? 'Auto-Renewal Enabled' : 'Manual Renewal'}
        </Badge>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50/50 rounded-xl border border-indigo-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}

      {/* Renewal Alerts */}
      {data.renewalAlerts && data.renewalAlerts.length > 0 && (
        <div className="space-y-2">
          {data.renewalAlerts.map((alert, i) => {
            const config = getAlertConfig(alert.type);
            const AlertIcon = config.icon;
            return (
              <div key={i} className={cn("p-4 rounded-xl border", config.bg, config.border)}>
                <div className="flex items-start gap-3">
                  <AlertIcon className={cn("h-5 w-5 shrink-0", config.text)} />
                  <div className="flex-1">
                    <p className={cn("text-sm font-medium", config.text)}>{alert.message}</p>
                    {alert.dueDate && (
                      <p className="text-xs text-slate-500 mt-1">Due: {formatDate(alert.dueDate)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Key Dates */}
      <div className="grid grid-cols-2 gap-4">
        {data.currentTermEnd && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-500 uppercase">Current Term Ends</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatDate(data.currentTermEnd)}</p>
          </div>
        )}
        {data.renewalTerms?.optOutDeadline && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-600 uppercase">Opt-Out Deadline</p>
            <p className="text-lg font-bold text-amber-700 mt-1">{formatDate(data.renewalTerms.optOutDeadline)}</p>
          </div>
        )}
        {data.terminationNotice && (
          <div className="p-4 bg-rose-50 rounded-xl border border-rose-200">
            <p className="text-xs text-rose-600 uppercase">Notice Required</p>
            <p className="text-lg font-bold text-rose-700 mt-1">{data.terminationNotice.requiredDays} days</p>
            {data.terminationNotice.format && (
              <p className="text-xs text-slate-500 mt-1">Format: {data.terminationNotice.format}</p>
            )}
          </div>
        )}
        {data.renewalTerms && (
          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
            <p className="text-xs text-indigo-600 uppercase">Renewal Period</p>
            <p className="text-lg font-bold text-indigo-700 mt-1">{data.renewalTerms.renewalPeriod}</p>
            <p className="text-xs text-slate-500 mt-1">{data.renewalTerms.noticePeriodDays} days notice</p>
          </div>
        )}
      </div>

      {/* Price Escalation */}
      {data.priceEscalation && data.priceEscalation.length > 0 && (
        <ExpandableSection
          title="Price Escalation"
          icon={TrendingUp}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.priceEscalation.length}</Badge>}
        >
          <div className="space-y-2">
            {data.priceEscalation.map((esc, i) => (
              <div key={i} className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{esc.type}</span>
                  {esc.percentage && (
                    <Badge className="bg-amber-100 text-amber-700">+{esc.percentage}%</Badge>
                  )}
                </div>
                {esc.index && <p className="text-xs text-slate-500 mt-1">Index: {esc.index}</p>}
                {esc.cap && <p className="text-xs text-slate-500">Cap: {esc.cap}%</p>}
                {esc.effectiveDate && <p className="text-xs text-slate-500">Effective: {formatDate(esc.effectiveDate)}</p>}
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-amber-100 text-amber-700">{data.optOutDeadlines.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-2">
            {data.optOutDeadlines.map((deadline, i) => (
              <div key={i} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{formatDate(deadline.date)}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{deadline.description}</p>
                  </div>
                  {deadline.daysRemaining !== undefined && (
                    <Badge className={deadline.daysRemaining < 30 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>
                      {deadline.daysRemaining} days
                    </Badge>
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
      'strong': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Strong' },
      'moderate': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Moderate' },
      'weak': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Weak' },
      'balanced': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Balanced' }
    }[strength] || { bg: 'bg-slate-100', text: 'text-slate-600', label: strength };
  };

  const leverageConfig = getStrengthConfig(data.overallLeverage || 'balanced');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Scale className="h-5 w-5 text-purple-500" />
            Negotiation Intelligence
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Strategic insights for contract negotiation
          </p>
        </div>
        <Badge className={cn(leverageConfig.bg, leverageConfig.text)}>
          {leverageConfig.label} Position
        </Badge>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-xl border border-purple-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}

      {/* Leverage Points */}
      {data.leveragePoints && data.leveragePoints.length > 0 && (
        <ExpandableSection
          title="Leverage Points"
          icon={TrendingUp}
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-emerald-100 text-emerald-700">{data.leveragePoints.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-3">
            {data.leveragePoints.map((point) => {
              const strengthConfig = getStrengthConfig(point.strength);
              return (
                <div key={point.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[10px]", strengthConfig.bg, strengthConfig.text)}>
                          {strengthConfig.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{point.category}</Badge>
                      </div>
                      <h4 className="font-medium text-slate-900 mt-2">{point.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{point.description}</p>
                      {point.suggestedAction && (
                        <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          {point.suggestedAction}
                        </p>
                      )}
                    </div>
                  </div>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-rose-100 text-rose-700">{data.weakClauses.length}</Badge>}
        >
          <div className="space-y-3">
            {data.weakClauses.map((clause) => (
              <div key={clause.id} className="p-4 bg-rose-50 rounded-xl border border-rose-200">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">{clause.clauseReference}</Badge>
                  <SeverityBadge severity={clause.impact} />
                </div>
                <p className="text-sm text-slate-900 font-medium mt-2">{clause.issue}</p>
                {clause.suggestedRevision && (
                  <div className="mt-3 p-2 bg-white rounded-lg border border-slate-200">
                    <p className="text-xs text-slate-500 uppercase mb-1">Suggested Revision</p>
                    <p className="text-sm text-slate-700">{clause.suggestedRevision}</p>
                  </div>
                )}
                {clause.benchmarkComparison && (
                  <p className="text-xs text-slate-500 mt-2">Market: {clause.benchmarkComparison}</p>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.benchmarkGaps.length}</Badge>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-medium text-slate-600">Area</th>
                  <th className="text-left py-2 font-medium text-slate-600">Current</th>
                  <th className="text-left py-2 font-medium text-slate-600">Market</th>
                  <th className="text-left py-2 font-medium text-slate-600">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {data.benchmarkGaps.map((gap, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-900 font-medium">{gap.area}</td>
                    <td className="py-3 text-rose-600">{gap.currentTerm}</td>
                    <td className="py-3 text-emerald-600">{gap.marketStandard}</td>
                    <td className="py-3 text-slate-600">{gap.recommendation}</td>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.negotiationScript.length} topics</Badge>}
        >
          <div className="space-y-4">
            {data.negotiationScript.map((script, i) => (
              <div key={i} className="p-4 bg-white rounded-xl border border-slate-200">
                <h4 className="font-medium text-slate-900">{script.topic}</h4>
                <div className="mt-3 space-y-2">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <p className="text-xs text-emerald-600 uppercase mb-1">Opening Position</p>
                    <p className="text-sm text-slate-700">{script.openingPosition}</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <p className="text-xs text-amber-600 uppercase mb-1">Fallback Position</p>
                    <p className="text-sm text-slate-700">{script.fallbackPosition}</p>
                  </div>
                  {script.walkAwayPoint && (
                    <div className="p-2 bg-rose-50 rounded-lg">
                      <p className="text-xs text-rose-600 uppercase mb-1">Walk Away Point</p>
                      <p className="text-sm text-slate-700">{script.walkAwayPoint}</p>
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
      'added': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Added' },
      'modified': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Modified' },
      'deleted': { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Deleted' }
    }[type] || { bg: 'bg-slate-100', text: 'text-slate-600', label: type };
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-indigo-500" />
            Amendments & Changes
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {data.amendments?.length || 0} amendments tracked
          </p>
        </div>
        {data.consolidatedTerms && (
          <Badge className="bg-blue-100 text-blue-700">
            v{data.consolidatedTerms.version}
          </Badge>
        )}
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50/50 rounded-xl border border-indigo-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}

      {/* Amendments */}
      {data.amendments && data.amendments.length > 0 && (
        <ExpandableSection
          title="Amendments"
          icon={FileText}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.amendments.length}</Badge>}
          defaultOpen
        >
          <div className="space-y-4">
            {data.amendments.map((amendment) => (
              <div key={amendment.id} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-100 text-indigo-700">
                        Amendment #{amendment.amendmentNumber}
                      </Badge>
                      <span className="text-xs text-slate-500">{formatDate(amendment.effectiveDate)}</span>
                    </div>
                    <h4 className="font-medium text-slate-900 mt-2">{amendment.title}</h4>
                    <p className="text-sm text-slate-600 mt-1">{amendment.description}</p>
                  </div>
                </div>
                
                {/* Changed Clauses */}
                {amendment.changedClauses.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-xs text-slate-500 uppercase">Changes</p>
                    {amendment.changedClauses.map((clause, i) => {
                      const config = getChangeTypeConfig(clause.changeType);
                      return (
                        <div key={i} className={cn("p-3 rounded-lg", config.bg)}>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[10px]">{clause.clauseId}</Badge>
                            <Badge className={cn("text-[10px]", config.bg, config.text)}>
                              {config.label}
                            </Badge>
                          </div>
                          {clause.originalText && (
                            <p className="text-sm text-slate-500 line-through mt-2">{clause.originalText}</p>
                          )}
                          <p className="text-sm text-slate-900 mt-1">{clause.newText}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Signed By */}
                {amendment.signedBy && amendment.signedBy.length > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <Users className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-500">
                      Signed by: {amendment.signedBy.join(', ')}
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.changeLog.length}</Badge>}
        >
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-4">
              {data.changeLog.map((entry, i) => (
                <div key={i} className="relative pl-10">
                  <div className="absolute left-2.5 w-3 h-3 rounded-full bg-white border-2 border-indigo-500" />
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px]">{entry.type}</Badge>
                      <span className="text-xs text-slate-500">{formatDate(entry.date)}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1">{entry.description}</p>
                    {entry.reference && (
                      <p className="text-xs text-slate-400 mt-1">Ref: {entry.reference}</p>
                    )}
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px] bg-slate-100">{data.supersededClauses.length}</Badge>}
        >
          <div className="space-y-2">
            {data.supersededClauses.map((clause, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 line-through">{clause.originalClause}</span>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-900 font-medium">{clause.supersededBy}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Effective: {formatDate(clause.effectiveDate)}</p>
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
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Key Contacts
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {data.primaryContacts?.length || 0} contacts • {data.escalationPath?.length || 0} escalation levels
          </p>
        </div>
      </div>

      {/* Summary */}
      {data.summary && (
        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50/50 rounded-xl border border-blue-200/50">
          <p className="text-sm text-slate-700">{data.summary}</p>
        </div>
      )}

      {/* Primary Contacts */}
      {data.primaryContacts && data.primaryContacts.length > 0 && (
        <ExpandableSection
          title="Primary Contacts"
          icon={Users}
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.primaryContacts.length}</Badge>}
          defaultOpen
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.primaryContacts.map((contact) => (
              <div key={contact.id} className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{contact.name}</h4>
                      {contact.isPrimary && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700">Primary</Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{contact.role}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{contact.party}</Badge>
                  </div>
                </div>
                
                <div className="mt-3 space-y-1">
                  {contact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Email:</span>
                      <button
                        onClick={() => copyToClipboard(contact.email!)}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {contact.email}
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-slate-500">Phone:</span>
                      <span className="text-slate-700">{contact.phone}</span>
                    </div>
                  )}
                  {contact.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <span className="text-slate-500 shrink-0">Address:</span>
                      <span className="text-slate-700">{contact.address}</span>
                    </div>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.escalationPath.length} levels</Badge>}
        >
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500 via-amber-500 to-rose-500" />
            <div className="space-y-3">
              {data.escalationPath.map((level, i) => (
                <div key={i} className="relative pl-10">
                  <div className="absolute left-2 w-5 h-5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-indigo-600">{level.level}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-900">{level.role}</h4>
                      {level.name && <span className="text-sm text-slate-600">{level.name}</span>}
                    </div>
                    {level.contactInfo && (
                      <p className="text-sm text-blue-600 mt-1">{level.contactInfo}</p>
                    )}
                    {level.escalationTrigger && (
                      <p className="text-xs text-slate-500 mt-2">
                        <span className="font-medium">Trigger:</span> {level.escalationTrigger}
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.notificationAddresses.length}</Badge>}
        >
          <div className="space-y-2">
            {data.notificationAddresses.map((addr, i) => (
              <div key={i} className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="text-[10px]">{addr.purpose}</Badge>
                    <p className="text-sm text-slate-900 font-medium mt-1">{addr.party}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{addr.address}</p>
                  </div>
                  {addr.format && (
                    <Badge className="text-[10px] bg-slate-100 text-slate-600">
                      {addr.format}
                    </Badge>
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
          badge={<Badge variant="secondary" className="ml-2 text-[10px]">{data.keyPersonnel.length}</Badge>}
        >
          <div className="space-y-3">
            {data.keyPersonnel.map((person, i) => (
              <div key={i} className="p-4 bg-white rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">{person.name}</h4>
                    <p className="text-sm text-slate-600">{person.role}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{person.party}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {person.responsibilities.map((resp, j) => (
                    <Badge key={j} className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                      {resp}
                    </Badge>
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

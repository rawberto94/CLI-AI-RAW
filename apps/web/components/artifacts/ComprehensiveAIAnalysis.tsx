'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  Brain,
  FileText,
  DollarSign,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Scale,
  Users,
  History,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Target,
  Lightbulb,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Zap,
  Eye,
  Layers,
  BarChart3,
  PieChart,
  ListChecks,
  FileWarning,
  CircleDot,
  ArrowRight,
  Info,
  XCircle,
  Bookmark,
  Download,
  Share2,
  MessageSquare,
  ExternalLink,
  Search,
  Loader2,
  Wand2
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'

// ============ TYPES ============

interface ArtifactData {
  overview?: any
  clauses?: any
  financial?: any
  risk?: any
  compliance?: any
  rates?: any
  obligations?: any
  renewal?: any
  negotiationPoints?: any
  amendments?: any
  contacts?: any
  keyClauses?: any
  financialAnalysis?: any
  riskAssessment?: any
  complianceCheck?: any
}

interface IntelligentAnalysisResult {
  success: boolean
  documentType: {
    primaryType: string
    subType?: string
    confidence: number
    industry?: string
    jurisdiction?: string
  }
  contractTypeProfile?: {
    type: string
    displayName: string
    criticalFields: string[]
    riskCategories: string[]
  } | null
  discoveredFields: {
    total: number
    highConfidence?: number
    needsReview?: number
    byImportance: Record<string, number>
    byCategory: Record<string, number>
    fields: Array<{
      fieldName: string
      displayName: string
      value: any
      valueType: string
      confidence: number
      originalConfidence?: number
      calibrationNote?: string
      source: string
      sourceSection: string
      importance: 'critical' | 'high' | 'medium' | 'low'
      category: string
      explanation: string
    }>
  }
  extractionQuality?: {
    averageConfidence: number
    patternVerified: number
    crossValidated: number
    needsHumanReview: string[]
  }
  industryBenchmarks?: {
    comparisons: Array<{
      fieldName: string
      extractedValue: number
      benchmark: {
        fieldName: string
        contractType: string
        benchmarks: {
          min: number
          max: number
          median: number
          unit: string
        }
      }
      position: 'below_market' | 'at_market' | 'above_market' | 'outlier'
      percentile: number
      recommendation?: string
    }>
    fieldsCompared: number
    outliers: number
    aboveMarket: number
    belowMarket: number
  } | null
  missingFields?: {
    predictions: Array<{
      fieldName: string
      displayName: string
      likelihood: number
      reason: string
      suggestedLocation: string
    }>
    criticalMissing: number
    likelyMissing: number
  } | null
  improvementSuggestions?: {
    total: number
    suggestions: Array<{
      fieldName: string
      currentValue: any
      issue: string
      suggestion: string
      improvedValue?: any
      confidence: number
      source: string
    }>
  } | null
  riskAnalysis: {
    totalRisks: number
    criticalRisks: number
    highRisks: number
    overallRiskLevel: string
    risks: Array<{
      id: string
      category: string
      title: string
      description: string
      severity: string
      likelihood: string
      sourceClause: string
      mitigationSuggestion: string
    }>
  }
  negotiationOpportunities: {
    total: number
    highPriority: number
    opportunities: Array<{
      id: string
      type: string
      title: string
      description: string
      currentTerm: string
      suggestedAlternative: string
      priority: string
      potentialBenefit: string
      negotiationTip: string
    }>
  }
  keyInsights: {
    total: number
    actionable: number
    insights: Array<{
      id: string
      type: string
      category: string
      title: string
      description: string
      severity: string
      actionable: boolean
      suggestedAction?: string
    }>
  }
  recommendations: {
    total: number
    urgent: number
    recommendations: Array<{
      id: string
      category: string
      priority: string
      title: string
      description: string
      reason: string
    }>
  }
}

interface ComprehensiveAIAnalysisProps {
  artifacts: ArtifactData
  contractId: string
  contractType?: string
  className?: string
  onRequestAnalysis?: (section: string) => void
  documentText?: string // For intelligent deep analysis
}

// ============ ANALYSIS SECTION CARD ============

interface AnalysisSectionProps {
  title: string
  description: string
  icon: React.ElementType
  iconColor: string
  bgGradient: string
  score?: number
  scoreLabel?: string
  scoreColor?: 'success' | 'warning' | 'danger' | 'info'
  status?: 'complete' | 'partial' | 'missing' | 'not-applicable'
  children: React.ReactNode
  defaultExpanded?: boolean
  badge?: string
}

function AnalysisSection({
  title,
  description,
  icon: Icon,
  iconColor,
  bgGradient,
  score,
  scoreLabel,
  scoreColor = 'info',
  status = 'complete',
  children,
  defaultExpanded = true,
  badge
}: AnalysisSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  const scoreColors = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200'
  }

  const statusIcons = {
    complete: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    partial: <AlertCircle className="h-4 w-4 text-amber-500" />,
    missing: <XCircle className="h-4 w-4 text-rose-400" />,
    'not-applicable': <Info className="h-4 w-4 text-slate-400" />
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className={cn(
        "overflow-hidden border-slate-200/80 shadow-sm hover:shadow-md transition-shadow duration-200",
        status === 'missing' && "opacity-75"
      )}>
        {/* Header with gradient bar */}
        <div className={cn("h-1", bgGradient)} />
        
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-slate-50/50 transition-colors py-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                  iconColor
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold text-slate-800">{title}</CardTitle>
                    {badge && (
                      <Badge variant="secondary" className="text-xs px-2 py-0.5">
                        {badge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    {description}
                  </CardDescription>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Status indicator */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      {statusIcons[status]}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs capitalize">{status.replace('-', ' ')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Score badge */}
                {score !== undefined && (
                  <div className={cn(
                    "px-3 py-1.5 rounded-lg border text-sm font-semibold flex items-center gap-1.5",
                    scoreColors[scoreColor]
                  )}>
                    <span>{score}</span>
                    {scoreLabel && <span className="text-xs font-normal opacity-75">{scoreLabel}</span>}
                  </div>
                )}
                
                <ChevronDown className={cn(
                  "h-5 w-5 text-slate-400 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-5 pb-5">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ============ INSIGHT CARD ============

interface InsightCardProps {
  type: 'risk' | 'opportunity' | 'info' | 'warning' | 'action'
  title: string
  description: string
  priority?: 'high' | 'medium' | 'low'
  action?: {
    label: string
    onClick: () => void
  }
}

function InsightCard({ type, title, description, priority, action }: InsightCardProps) {
  const typeStyles = {
    risk: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      icon: AlertTriangle,
      iconColor: 'text-rose-500'
    },
    opportunity: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: TrendingUp,
      iconColor: 'text-emerald-500'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: Info,
      iconColor: 'text-blue-500'
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: AlertCircle,
      iconColor: 'text-amber-500'
    },
    action: {
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
      icon: Target,
      iconColor: 'text-indigo-500'
    }
  }

  const style = typeStyles[type]
  const Icon = style.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border",
        style.bg,
        style.border
      )}
    >
      <div className="flex gap-3">
        <div className={cn("mt-0.5", style.iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-slate-800">{title}</h4>
            {priority && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  priority === 'high' && "border-rose-300 text-rose-600",
                  priority === 'medium' && "border-amber-300 text-amber-600",
                  priority === 'low' && "border-slate-300 text-slate-500"
                )}
              >
                {priority}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-600">{description}</p>
          {action && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 -ml-2 h-8 text-xs"
              onClick={action.onClick}
            >
              {action.label}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ============ EMPTY STATE ============

interface EmptyAnalysisStateProps {
  section: string
  icon: React.ElementType
  onRequestAnalysis?: () => void
}

function EmptyAnalysisState({ section, icon: Icon, onRequestAnalysis }: EmptyAnalysisStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-700 mb-1">No {section} Found</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">
        The AI couldn&apos;t extract {section.toLowerCase()} information from this contract. 
        This could be because the document doesn&apos;t contain this type of information.
      </p>
      {onRequestAnalysis && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRequestAnalysis}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Request AI Analysis
        </Button>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function ComprehensiveAIAnalysis({
  artifacts,
  contractId,
  contractType = 'General',
  className,
  onRequestAnalysis,
  documentText
}: ComprehensiveAIAnalysisProps) {
  const [activeView, setActiveView] = useState<'overview' | 'detailed' | 'discovered'>('overview')
  const [isRunningDeepAnalysis, setIsRunningDeepAnalysis] = useState(false)
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<IntelligentAnalysisResult | null>(null)
  const [showDeepAnalysis, setShowDeepAnalysis] = useState(false)

  // Run intelligent deep analysis
  const runDeepAnalysis = useCallback(async () => {
    if (!documentText) {
      toast.error('Document text not available for deep analysis')
      return
    }

    setIsRunningDeepAnalysis(true)
    try {
      const response = await fetch('/api/contracts/intelligent-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentText,
          contractId,
          options: { targetConfidence: 0.8 }
        })
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const result = await response.json()
      setDeepAnalysisResult(result)
      setShowDeepAnalysis(true)
      setActiveView('discovered')
      toast.success(`Discovered ${result.discoveredFields?.total || 0} additional fields!`)
    } catch {
      toast.error('Failed to run deep analysis')
    } finally {
      setIsRunningDeepAnalysis(false)
    }
  }, [documentText, contractId])
  
  // Normalize artifact data
  const data = useMemo(() => ({
    overview: artifacts.overview || null,
    clauses: artifacts.clauses || artifacts.keyClauses || null,
    financial: artifacts.financial || artifacts.financialAnalysis || null,
    risk: artifacts.risk || artifacts.riskAssessment || null,
    compliance: artifacts.compliance || artifacts.complianceCheck || null,
    obligations: artifacts.obligations || null,
    renewal: artifacts.renewal || null,
    negotiationPoints: artifacts.negotiationPoints || null,
    amendments: artifacts.amendments || null,
    contacts: artifacts.contacts || null
  }), [artifacts])

  // Calculate overall health score
  const healthScore = useMemo(() => {
    let score = 100
    const factors: { label: string; impact: number; status: 'good' | 'warning' | 'critical' }[] = []
    
    // Risk impact
    const riskScore = data.risk?.riskScore || data.risk?.overallScore || 50
    if (riskScore >= 70) {
      score -= 30
      factors.push({ label: 'High risk level', impact: -30, status: 'critical' })
    } else if (riskScore >= 50) {
      score -= 15
      factors.push({ label: 'Moderate risk', impact: -15, status: 'warning' })
    }
    
    // Compliance impact
    const complianceScore = data.compliance?.score || data.compliance?.complianceScore || 80
    if (complianceScore < 60) {
      score -= 25
      factors.push({ label: 'Compliance gaps', impact: -25, status: 'critical' })
    } else if (complianceScore < 80) {
      score -= 10
      factors.push({ label: 'Minor compliance issues', impact: -10, status: 'warning' })
    }
    
    // Missing data impact
    const missingCount = [data.overview, data.clauses, data.financial, data.risk].filter(d => !d).length
    if (missingCount > 2) {
      score -= 20
      factors.push({ label: 'Incomplete analysis', impact: -20, status: 'warning' })
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
      factors
    }
  }, [data])

  // Extract key insights
  const insights = useMemo(() => {
    const items: InsightCardProps[] = []
    
    // Risk insights
    const riskFactors = data.risk?.riskFactors || data.risk?.factors || []
    riskFactors.slice(0, 2).forEach((risk: any) => {
      if (risk.severity === 'high' || risk.severity === 'critical') {
        items.push({
          type: 'risk',
          title: risk.category || 'Risk Identified',
          description: risk.description || risk.factor || 'A significant risk factor was identified',
          priority: risk.severity === 'critical' ? 'high' : 'medium'
        })
      }
    })
    
    // Compliance insights
    const complianceIssues = data.compliance?.issues || []
    complianceIssues.slice(0, 2).forEach((issue: any) => {
      if (issue.status === 'non-compliant') {
        items.push({
          type: 'warning',
          title: issue.regulation || 'Compliance Issue',
          description: issue.requirement || issue.description || 'Compliance requirement not met',
          priority: 'high'
        })
      }
    })
    
    // Renewal insights
    if (data.renewal?.autoRenewal) {
      items.push({
        type: 'info',
        title: 'Auto-Renewal Active',
        description: `This contract will automatically renew. Notice period: ${data.renewal.renewalTerms?.noticePeriodDays || 30} days`,
        priority: 'medium'
      })
    }
    
    // Financial opportunities
    if (data.negotiationPoints?.weakClauses?.length > 0) {
      items.push({
        type: 'opportunity',
        title: 'Negotiation Opportunities',
        description: `${data.negotiationPoints.weakClauses.length} clauses identified that could be renegotiated for better terms`,
        priority: 'medium'
      })
    }
    
    return items.slice(0, 4)
  }, [data])

  // Quick stats
  const stats = useMemo(() => ({
    riskScore: data.risk?.riskScore || data.risk?.overallScore || null,
    complianceScore: data.compliance?.score || data.compliance?.complianceScore || null,
    totalValue: data.financial?.totalValue || data.financial?.tcv || null,
    clauseCount: data.clauses?.clauses?.length || data.clauses?.keyClauses?.length || 0,
    obligationCount: data.obligations?.obligations?.length || 0,
    riskCount: (data.risk?.riskFactors || data.risk?.factors || []).filter((r: any) => 
      r.severity === 'high' || r.severity === 'critical'
    ).length
  }), [data])

  const handleRequestAnalysis = useCallback((section: string) => {
    if (onRequestAnalysis) {
      onRequestAnalysis(section)
    } else {
      // Default: open AI chatbot with analysis request
      window.dispatchEvent(new CustomEvent('openAIChatbot', { 
        detail: { 
          autoMessage: `Please analyze the ${section} section of this contract in detail.`,
          section,
          contractId
        } 
      }))
    }
  }, [contractId, onRequestAnalysis])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">AI Contract Analysis</h2>
            <p className="text-sm text-slate-500">Comprehensive analysis powered by AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          {documentText && (
            <Button 
              size="sm" 
              variant="outline"
              className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={runDeepAnalysis}
              disabled={isRunningDeepAnalysis}
            >
              {isRunningDeepAnalysis ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Deep Analysis
                </>
              )}
            </Button>
          )}
          <Button 
            size="sm" 
            className="gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
            onClick={() => handleRequestAnalysis('full contract')}
          >
            <RefreshCw className="h-4 w-4" />
            Re-analyze
          </Button>
        </div>
      </div>

      {/* Health Score & Quick Stats */}
      <Card className="border-slate-200/80 shadow-sm overflow-hidden">
        <div className={cn(
          "h-1.5",
          healthScore.status === 'excellent' && "bg-gradient-to-r from-emerald-400 to-emerald-500",
          healthScore.status === 'good' && "bg-gradient-to-r from-blue-400 to-blue-500",
          healthScore.status === 'fair' && "bg-gradient-to-r from-amber-400 to-amber-500",
          healthScore.status === 'poor' && "bg-gradient-to-r from-rose-400 to-rose-500"
        )} />
        
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Health Score */}
            <div className="lg:col-span-1 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-inner mb-2",
                healthScore.status === 'excellent' && "bg-emerald-100 text-emerald-700",
                healthScore.status === 'good' && "bg-blue-100 text-blue-700",
                healthScore.status === 'fair' && "bg-amber-100 text-amber-700",
                healthScore.status === 'poor' && "bg-rose-100 text-rose-700"
              )}>
                {healthScore.score}
              </div>
              <p className="font-medium text-slate-700">Health Score</p>
              <p className={cn(
                "text-xs font-medium capitalize",
                healthScore.status === 'excellent' && "text-emerald-600",
                healthScore.status === 'good' && "text-blue-600",
                healthScore.status === 'fair' && "text-amber-600",
                healthScore.status === 'poor' && "text-rose-600"
              )}>
                {healthScore.status}
              </p>
            </div>
            
            {/* Quick Stats */}
            <div className="lg:col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Risk Score */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={cn(
                    "h-4 w-4",
                    (stats.riskScore || 0) < 40 ? "text-emerald-500" : 
                    (stats.riskScore || 0) < 70 ? "text-amber-500" : "text-rose-500"
                  )} />
                  <span className="text-xs font-medium text-slate-500">Risk Score</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.riskScore !== null ? stats.riskScore : '--'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.riskCount > 0 ? `${stats.riskCount} high risks` : 'No high risks'}
                </p>
              </div>
              
              {/* Compliance */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={cn(
                    "h-4 w-4",
                    (stats.complianceScore || 0) >= 80 ? "text-emerald-500" : 
                    (stats.complianceScore || 0) >= 60 ? "text-amber-500" : "text-rose-500"
                  )} />
                  <span className="text-xs font-medium text-slate-500">Compliance</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.complianceScore !== null ? `${stats.complianceScore}%` : '--'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(stats.complianceScore || 0) >= 80 ? 'Compliant' : 'Needs review'}
                </p>
              </div>
              
              {/* Contract Value */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-medium text-slate-500">Total Value</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.totalValue !== null 
                    ? `$${(stats.totalValue / 1000).toFixed(0)}K` 
                    : '--'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Contract value
                </p>
              </div>
              
              {/* Key Clauses */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="h-4 w-4 text-indigo-500" />
                  <span className="text-xs font-medium text-slate-500">Clauses</span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {stats.clauseCount || '--'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Key clauses found
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      {insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800">Key Insights</h3>
            <Badge variant="secondary" className="ml-1">{insights.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, i) => (
              <InsightCard key={i} {...insight} />
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-600" />
            Detailed Analysis
          </h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <Button
              variant={activeView === 'overview' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveView('overview')}
            >
              Overview
            </Button>
            <Button
              variant={activeView === 'detailed' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveView('detailed')}
            >
              Detailed
            </Button>
            {deepAnalysisResult && (
              <Button
                variant={activeView === 'discovered' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setActiveView('discovered')}
              >
                <Sparkles className="h-3 w-3" />
                Discovered ({deepAnalysisResult.discoveredFields.total})
              </Button>
            )}
          </div>
        </div>

        {/* Deep Analysis Results */}
        {activeView === 'discovered' && deepAnalysisResult && (
          <div className="space-y-4">
            {/* Extraction Quality Summary */}
            {deepAnalysisResult.extractionQuality && (
              <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-emerald-800">Extraction Quality Report</h4>
                      <p className="text-xs text-emerald-600">Multi-pass validation with pattern verification</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-emerald-700">
                        {Math.round(deepAnalysisResult.extractionQuality.averageConfidence * 100)}%
                      </div>
                      <div className="text-xs text-emerald-600">Avg Confidence</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-blue-700">
                        {deepAnalysisResult.extractionQuality.patternVerified}
                      </div>
                      <div className="text-xs text-blue-600">Pattern Verified</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-violet-700">
                        {deepAnalysisResult.extractionQuality.crossValidated}
                      </div>
                      <div className="text-xs text-violet-600">Cross-Validated</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-amber-700">
                        {deepAnalysisResult.extractionQuality.needsHumanReview?.length || 0}
                      </div>
                      <div className="text-xs text-amber-600">Needs Review</div>
                    </div>
                  </div>
                  {deepAnalysisResult.extractionQuality.needsHumanReview?.length > 0 && (
                    <div className="mt-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-xs font-medium text-amber-700 mb-1">Fields requiring review:</div>
                      <div className="flex flex-wrap gap-1">
                        {deepAnalysisResult.extractionQuality.needsHumanReview.map((field, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-amber-300 text-amber-600">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Industry Benchmarks Comparison */}
            {deepAnalysisResult.industryBenchmarks && deepAnalysisResult.industryBenchmarks.comparisons.length > 0 && (
              <Card className="bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-500 text-white">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-indigo-800">Industry Benchmark Comparison</h4>
                      <p className="text-xs text-indigo-600">How your contract terms compare to market standards</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-indigo-700">
                        {deepAnalysisResult.industryBenchmarks.fieldsCompared}
                      </div>
                      <div className="text-xs text-indigo-600">Fields Compared</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-emerald-700">
                        {deepAnalysisResult.industryBenchmarks.aboveMarket}
                      </div>
                      <div className="text-xs text-emerald-600">Above Market</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-amber-700">
                        {deepAnalysisResult.industryBenchmarks.belowMarket}
                      </div>
                      <div className="text-xs text-amber-600">Below Market</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-rose-700">
                        {deepAnalysisResult.industryBenchmarks.outliers}
                      </div>
                      <div className="text-xs text-rose-600">Outliers</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {deepAnalysisResult.industryBenchmarks.comparisons.map((comp, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "p-2 rounded-lg border bg-white/60",
                          comp.position === 'above_market' && "border-emerald-300",
                          comp.position === 'below_market' && "border-amber-300",
                          comp.position === 'outlier' && "border-rose-300",
                          comp.position === 'at_market' && "border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">
                            {comp.fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px]",
                                comp.position === 'above_market' && "border-emerald-300 text-emerald-600 bg-emerald-50",
                                comp.position === 'below_market' && "border-amber-300 text-amber-600 bg-amber-50",
                                comp.position === 'outlier' && "border-rose-300 text-rose-600 bg-rose-50",
                                comp.position === 'at_market' && "border-blue-300 text-blue-600 bg-blue-50"
                              )}
                            >
                              {comp.position === 'above_market' && <TrendingUp className="h-3 w-3 mr-1" />}
                              {comp.position === 'below_market' && <TrendingDown className="h-3 w-3 mr-1" />}
                              {comp.position.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500">Your value:</span>
                          <span className="text-xs font-medium">{comp.extractedValue} {comp.benchmark.benchmarks.unit}</span>
                          <span className="text-xs text-slate-400">|</span>
                          <span className="text-xs text-slate-500">Market median:</span>
                          <span className="text-xs font-medium">{comp.benchmark.benchmarks.median} {comp.benchmark.benchmarks.unit}</span>
                        </div>
                        {comp.recommendation && (
                          <p className="text-xs text-indigo-600 mt-1 flex items-start gap-1">
                            <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {comp.recommendation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Missing Fields Predictions */}
            {deepAnalysisResult.missingFields && deepAnalysisResult.missingFields.predictions.length > 0 && (
              <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                      <FileWarning className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-amber-800">Potentially Missing Information</h4>
                      <p className="text-xs text-amber-600">
                        {deepAnalysisResult.missingFields.criticalMissing} critical, {deepAnalysisResult.missingFields.likelyMissing} likely missing fields
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {deepAnalysisResult.missingFields.predictions
                      .filter(p => p.likelihood > 0.5)
                      .slice(0, 8)
                      .map((pred, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "p-2 rounded-lg border bg-white/60",
                          pred.likelihood > 0.9 && "border-rose-300",
                          pred.likelihood > 0.6 && pred.likelihood <= 0.9 && "border-amber-300",
                          pred.likelihood <= 0.6 && "border-slate-300"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-700">{pred.displayName}</span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              pred.likelihood > 0.9 && "border-rose-300 text-rose-600",
                              pred.likelihood > 0.6 && "border-amber-300 text-amber-600"
                            )}
                          >
                            {Math.round(pred.likelihood * 100)}% likely missing
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{pred.reason}</p>
                        <p className="text-xs text-amber-600 mt-1">Look in: {pred.suggestedLocation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Discovered Fields */}
            <AnalysisSection
              title="Discovered Information"
              description={`${deepAnalysisResult.discoveredFields.total} data points automatically extracted`}
              icon={Search}
              iconColor="bg-gradient-to-br from-purple-500 to-pink-500"
              bgGradient="bg-gradient-to-r from-purple-500 to-pink-500"
              status="complete"
              badge={`${deepAnalysisResult.discoveredFields.highConfidence || 0} high confidence`}
            >
              <div className="space-y-4">
                {/* Category Summary */}
                <div className="flex flex-wrap gap-2">
                  {Object.entries(deepAnalysisResult.discoveredFields.byCategory).map(([cat, count]) => (
                    <Badge key={cat} variant="secondary" className="text-xs">
                      {cat}: {count}
                    </Badge>
                  ))}
                </div>
                
                {/* Field List */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {deepAnalysisResult.discoveredFields.fields
                    .sort((a, b) => {
                      const order = { critical: 0, high: 1, medium: 2, low: 3 }
                      return (order[a.importance] || 3) - (order[b.importance] || 3)
                    })
                    .map((field, i) => (
                    <div 
                      key={i}
                      className={cn(
                        "p-3 rounded-lg border",
                        field.importance === 'critical' && "bg-rose-50 border-rose-200",
                        field.importance === 'high' && "bg-amber-50 border-amber-200",
                        field.importance === 'medium' && "bg-blue-50 border-blue-200",
                        field.importance === 'low' && "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-800">{field.displayName}</span>
                        <div className="flex items-center gap-2">
                          {/* Confidence Indicator */}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  field.confidence >= 0.85 && "bg-emerald-100 text-emerald-700",
                                  field.confidence >= 0.7 && field.confidence < 0.85 && "bg-blue-100 text-blue-700",
                                  field.confidence >= 0.5 && field.confidence < 0.7 && "bg-amber-100 text-amber-700",
                                  field.confidence < 0.5 && "bg-rose-100 text-rose-700"
                                )}>
                                  {field.confidence >= 0.85 ? <CheckCircle2 className="h-3 w-3" /> : 
                                   field.confidence >= 0.7 ? <CircleDot className="h-3 w-3" /> :
                                   <AlertCircle className="h-3 w-3" />}
                                  {Math.round(field.confidence * 100)}%
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  Extraction confidence: {Math.round(field.confidence * 100)}%
                                  {field.confidence >= 0.85 ? ' - High confidence' :
                                   field.confidence >= 0.7 ? ' - Moderate confidence' :
                                   ' - Needs verification'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Badge variant="outline" className="text-[10px]">
                            {field.category}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px]",
                              field.importance === 'critical' && "border-rose-300 text-rose-600",
                              field.importance === 'high' && "border-amber-300 text-amber-600"
                            )}
                          >
                            {field.importance}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm font-mono bg-white/50 px-2 py-1 rounded">
                        {typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}
                      </p>
                      {field.explanation && (
                        <p className={cn(
                          "text-xs mt-1",
                          field.explanation.includes('⚠️') && "text-amber-600",
                          field.explanation.includes('❌') && "text-rose-600",
                          field.explanation.includes('Pattern-verified') && "text-emerald-600",
                          !field.explanation.includes('⚠️') && !field.explanation.includes('❌') && !field.explanation.includes('Pattern-verified') && "text-slate-500"
                        )}>
                          {field.explanation}
                        </p>
                      )}
                      {field.source && (
                        <p className="text-xs text-slate-400 mt-1 italic">Source: &quot;{field.source.slice(0, 100)}...&quot;</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </AnalysisSection>

            {/* AI-Discovered Risks */}
            {deepAnalysisResult.riskAnalysis.risks.length > 0 && (
              <AnalysisSection
                title="Deep Risk Analysis"
                description={`${deepAnalysisResult.riskAnalysis.totalRisks} risks identified by AI`}
                icon={AlertTriangle}
                iconColor="bg-gradient-to-br from-rose-500 to-orange-500"
                bgGradient="bg-gradient-to-r from-rose-500 to-orange-500"
                status="complete"
                score={deepAnalysisResult.riskAnalysis.criticalRisks + deepAnalysisResult.riskAnalysis.highRisks}
                scoreLabel=" high"
                scoreColor={deepAnalysisResult.riskAnalysis.criticalRisks > 0 ? 'danger' : 
                  deepAnalysisResult.riskAnalysis.highRisks > 2 ? 'warning' : 'info'}
              >
                <div className="space-y-3">
                  {deepAnalysisResult.riskAnalysis.risks.map((risk) => (
                    <div 
                      key={risk.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        risk.severity === 'critical' && "bg-rose-50 border-rose-200",
                        risk.severity === 'high' && "bg-amber-50 border-amber-200",
                        risk.severity === 'medium' && "bg-yellow-50 border-yellow-200",
                        risk.severity === 'low' && "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-800">{risk.title}</h4>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          risk.severity === 'critical' && "border-rose-300 text-rose-600",
                          risk.severity === 'high' && "border-amber-300 text-amber-600"
                        )}>
                          {risk.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{risk.description}</p>
                      {risk.sourceClause && (
                        <div className="p-2 bg-white/50 rounded text-xs text-slate-500 mb-2 italic">
                          &quot;{risk.sourceClause.slice(0, 150)}...&quot;
                        </div>
                      )}
                      <div className="flex items-start gap-1.5 text-xs text-emerald-600 bg-emerald-50 p-2 rounded">
                        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{risk.mitigationSuggestion}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </AnalysisSection>
            )}

            {/* Negotiation Opportunities */}
            {deepAnalysisResult.negotiationOpportunities.opportunities.length > 0 && (
              <AnalysisSection
                title="Negotiation Opportunities"
                description={`${deepAnalysisResult.negotiationOpportunities.total} opportunities identified`}
                icon={Target}
                iconColor="bg-gradient-to-br from-emerald-500 to-teal-500"
                bgGradient="bg-gradient-to-r from-emerald-500 to-teal-500"
                status="complete"
                badge={`${deepAnalysisResult.negotiationOpportunities.highPriority} high priority`}
              >
                <div className="space-y-3">
                  {deepAnalysisResult.negotiationOpportunities.opportunities.map((opp) => (
                    <div key={opp.id} className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-slate-800">{opp.title}</h4>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          opp.priority === 'high' && "border-rose-300 text-rose-600"
                        )}>
                          {opp.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{opp.description}</p>
                      
                      {opp.currentTerm && (
                        <div className="mb-2">
                          <p className="text-xs text-slate-500 mb-1">Current Term:</p>
                          <p className="text-xs bg-white/50 p-2 rounded italic">&quot;{opp.currentTerm.slice(0, 150)}...&quot;</p>
                        </div>
                      )}
                      
                      {opp.suggestedAlternative && (
                        <div className="mb-2">
                          <p className="text-xs text-emerald-600 mb-1">Suggested Alternative:</p>
                          <p className="text-xs bg-white p-2 rounded border border-emerald-200">{opp.suggestedAlternative}</p>
                        </div>
                      )}
                      
                      <div className="flex items-start gap-1.5 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        <Lightbulb className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>{opp.negotiationTip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </AnalysisSection>
            )}

            {/* AI Recommendations */}
            {deepAnalysisResult.recommendations.recommendations.length > 0 && (
              <AnalysisSection
                title="AI Recommendations"
                description={`${deepAnalysisResult.recommendations.total} actionable recommendations`}
                icon={Lightbulb}
                iconColor="bg-gradient-to-br from-yellow-500 to-orange-500"
                bgGradient="bg-gradient-to-r from-yellow-500 to-orange-500"
                status="complete"
                badge={deepAnalysisResult.recommendations.urgent > 0 ? `${deepAnalysisResult.recommendations.urgent} urgent` : undefined}
              >
                <div className="space-y-2">
                  {deepAnalysisResult.recommendations.recommendations.map((rec) => (
                    <div 
                      key={rec.id}
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-3",
                        rec.priority === 'urgent' && "bg-rose-50 border-rose-200",
                        rec.priority === 'high' && "bg-amber-50 border-amber-200",
                        rec.priority === 'medium' && "bg-blue-50 border-blue-200",
                        rec.priority === 'low' && "bg-slate-50 border-slate-200"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        rec.priority === 'urgent' && "bg-rose-100",
                        rec.priority === 'high' && "bg-amber-100",
                        rec.priority === 'medium' && "bg-blue-100",
                        rec.priority === 'low' && "bg-slate-100"
                      )}>
                        {rec.priority === 'urgent' ? (
                          <AlertCircle className="h-4 w-4 text-rose-600" />
                        ) : (
                          <ArrowRight className="h-4 w-4 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-800 text-sm">{rec.title}</h4>
                        <p className="text-xs text-slate-600">{rec.description}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">
                          {rec.category}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </AnalysisSection>
            )}
          </div>
        )}

        {activeView !== 'discovered' && (
          <>
        {/* Overview Section */}
        <AnalysisSection
          title="Contract Overview"
          description="Key terms, parties, and summary"
          icon={FileText}
          iconColor="bg-gradient-to-br from-blue-500 to-cyan-500"
          bgGradient="bg-gradient-to-r from-blue-500 to-cyan-500"
          status={data.overview ? 'complete' : 'missing'}
          badge={contractType}
        >
          {data.overview ? (
            <div className="space-y-4">
              {/* Summary */}
              {data.overview.summary && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {data.overview.summary}
                  </p>
                </div>
              )}
              
              {/* Parties */}
              {data.overview.parties && data.overview.parties.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Parties
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.overview.parties.map((party: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Users className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 text-sm">
                            {typeof party === 'string' ? party : party.name}
                          </p>
                          {party.role && (
                            <p className="text-xs text-slate-500">{party.role}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Key Terms */}
              {data.overview.keyTerms && data.overview.keyTerms.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Key Terms
                  </h4>
                  <ul className="space-y-1">
                    {data.overview.keyTerms.slice(0, 6).map((term: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <CircleDot className="h-3 w-3 text-blue-500 mt-1.5 shrink-0" />
                        <span>{term}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Overview" 
              icon={FileText}
              onRequestAnalysis={() => handleRequestAnalysis('overview')}
            />
          )}
        </AnalysisSection>

        {/* Risk Analysis */}
        <AnalysisSection
          title="Risk Assessment"
          description="Identified risks and mitigation recommendations"
          icon={AlertTriangle}
          iconColor="bg-gradient-to-br from-amber-500 to-orange-500"
          bgGradient="bg-gradient-to-r from-amber-500 to-orange-500"
          score={stats.riskScore || undefined}
          scoreLabel="/100"
          scoreColor={
            (stats.riskScore || 0) < 40 ? 'success' : 
            (stats.riskScore || 0) < 70 ? 'warning' : 'danger'
          }
          status={data.risk ? 'complete' : 'missing'}
        >
          {data.risk ? (
            <div className="space-y-4">
              {/* Risk Level Indicator */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold",
                  (stats.riskScore || 0) < 40 && "bg-emerald-100 text-emerald-700",
                  (stats.riskScore || 0) >= 40 && (stats.riskScore || 0) < 70 && "bg-amber-100 text-amber-700",
                  (stats.riskScore || 0) >= 70 && "bg-rose-100 text-rose-700"
                )}>
                  {stats.riskScore || 0}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    {(stats.riskScore || 0) < 40 ? 'Low Risk' : 
                     (stats.riskScore || 0) < 70 ? 'Moderate Risk' : 'High Risk'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {data.risk.summary || 'Risk assessment based on contract analysis'}
                  </p>
                  <Progress 
                    value={stats.riskScore || 0} 
                    className="h-2 mt-2"
                  />
                </div>
              </div>
              
              {/* Risk Factors */}
              {(data.risk.riskFactors || data.risk.factors || []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Risk Factors</h4>
                  <div className="space-y-2">
                    {(data.risk.riskFactors || data.risk.factors || []).map((factor: any, i: number) => (
                      <div 
                        key={i}
                        className={cn(
                          "p-3 rounded-lg border",
                          factor.severity === 'critical' && "bg-rose-50 border-rose-200",
                          factor.severity === 'high' && "bg-amber-50 border-amber-200",
                          factor.severity === 'medium' && "bg-yellow-50 border-yellow-200",
                          factor.severity === 'low' && "bg-slate-50 border-slate-200"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-slate-800 text-sm">
                            {factor.category || factor.type || 'Risk'}
                          </span>
                          <Badge 
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              factor.severity === 'critical' && "border-rose-300 text-rose-600",
                              factor.severity === 'high' && "border-amber-300 text-amber-600",
                              factor.severity === 'medium' && "border-yellow-300 text-yellow-600",
                              factor.severity === 'low' && "border-slate-300 text-slate-500"
                            )}
                          >
                            {factor.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600">{factor.description || factor.factor}</p>
                        {factor.mitigation && (
                          <div className="mt-2 p-2 bg-white/50 rounded text-xs text-slate-500 flex items-start gap-1.5">
                            <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                            <span>{factor.mitigation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Risk Assessment" 
              icon={AlertTriangle}
              onRequestAnalysis={() => handleRequestAnalysis('risk')}
            />
          )}
        </AnalysisSection>

        {/* Compliance Analysis */}
        <AnalysisSection
          title="Compliance Check"
          description="Regulatory compliance and policy adherence"
          icon={Shield}
          iconColor="bg-gradient-to-br from-violet-500 to-purple-500"
          bgGradient="bg-gradient-to-r from-violet-500 to-purple-500"
          score={stats.complianceScore || undefined}
          scoreLabel="%"
          scoreColor={
            (stats.complianceScore || 0) >= 80 ? 'success' : 
            (stats.complianceScore || 0) >= 60 ? 'warning' : 'danger'
          }
          status={data.compliance ? 'complete' : 'missing'}
        >
          {data.compliance ? (
            <div className="space-y-4">
              {/* Compliance Score */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold",
                  (stats.complianceScore || 0) >= 80 && "bg-emerald-100 text-emerald-700",
                  (stats.complianceScore || 0) >= 60 && (stats.complianceScore || 0) < 80 && "bg-amber-100 text-amber-700",
                  (stats.complianceScore || 0) < 60 && "bg-rose-100 text-rose-700"
                )}>
                  {stats.complianceScore || 0}%
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800">
                    {(stats.complianceScore || 0) >= 80 ? 'Compliant' : 
                     (stats.complianceScore || 0) >= 60 ? 'Partially Compliant' : 'Non-Compliant'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {data.compliance.summary || 'Compliance status based on analysis'}
                  </p>
                </div>
              </div>
              
              {/* Compliance Issues */}
              {(data.compliance.issues || []).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Compliance Issues</h4>
                  <div className="space-y-2">
                    {data.compliance.issues.map((issue: any, i: number) => (
                      <div 
                        key={i}
                        className={cn(
                          "p-3 rounded-lg border flex items-start gap-3",
                          issue.status === 'non-compliant' && "bg-rose-50 border-rose-200",
                          issue.status === 'at-risk' && "bg-amber-50 border-amber-200",
                          issue.status === 'compliant' && "bg-emerald-50 border-emerald-200"
                        )}
                      >
                        {issue.status === 'non-compliant' ? (
                          <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                        ) : issue.status === 'at-risk' ? (
                          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{issue.regulation || 'Requirement'}</p>
                          <p className="text-sm text-slate-600">{issue.requirement || issue.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Compliance Check" 
              icon={Shield}
              onRequestAnalysis={() => handleRequestAnalysis('compliance')}
            />
          )}
        </AnalysisSection>

        {/* Key Clauses */}
        <AnalysisSection
          title="Key Clauses"
          description="Important contractual provisions and terms"
          icon={FileCheck}
          iconColor="bg-gradient-to-br from-indigo-500 to-blue-500"
          bgGradient="bg-gradient-to-r from-indigo-500 to-blue-500"
          badge={`${stats.clauseCount} found`}
          status={data.clauses ? 'complete' : 'missing'}
        >
          {data.clauses ? (
            <div className="space-y-3">
              {(data.clauses.clauses || data.clauses.keyClauses || []).slice(0, 6).map((clause: any, i: number) => (
                <div 
                  key={i}
                  className="p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-slate-800">
                      {clause.title || clause.name || `Clause ${i + 1}`}
                    </h4>
                    {clause.importance && (
                      <Badge 
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          clause.importance === 'high' && "border-rose-300 text-rose-600",
                          clause.importance === 'medium' && "border-amber-300 text-amber-600",
                          clause.importance === 'low' && "border-slate-300 text-slate-500"
                        )}
                      >
                        {clause.importance}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {clause.content || clause.text || clause.description}
                  </p>
                  {clause.type && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {clause.type}
                    </Badge>
                  )}
                </div>
              ))}
              
              {(data.clauses.clauses || data.clauses.keyClauses || []).length > 6 && (
                <Button variant="outline" className="w-full" size="sm">
                  View all {(data.clauses.clauses || data.clauses.keyClauses || []).length} clauses
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Key Clauses" 
              icon={FileCheck}
              onRequestAnalysis={() => handleRequestAnalysis('clauses')}
            />
          )}
        </AnalysisSection>

        {/* Financial Analysis */}
        <AnalysisSection
          title="Financial Analysis"
          description="Contract value, payment terms, and financial details"
          icon={DollarSign}
          iconColor="bg-gradient-to-br from-emerald-500 to-green-500"
          bgGradient="bg-gradient-to-r from-emerald-500 to-green-500"
          status={data.financial ? 'complete' : 'missing'}
          defaultExpanded={activeView === 'detailed'}
        >
          {data.financial ? (
            <div className="space-y-4">
              {/* Financial Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {data.financial.totalValue && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-xs text-emerald-600 mb-1">Total Value</p>
                    <p className="text-xl font-bold text-emerald-700">
                      ${(data.financial.totalValue / 1000).toFixed(0)}K
                    </p>
                  </div>
                )}
                {data.financial.currency && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Currency</p>
                    <p className="text-xl font-bold text-slate-800">
                      {data.financial.currency}
                    </p>
                  </div>
                )}
                {data.financial.paymentTerms && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Payment Terms</p>
                    <p className="text-lg font-bold text-slate-800">
                      {data.financial.paymentTerms}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Rate Cards */}
              {data.financial.rateCards && data.financial.rateCards.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Rate Cards</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Role/Item</th>
                          <th className="px-3 py-2 text-right font-medium text-slate-600">Rate</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-600">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.financial.rateCards.slice(0, 5).map((rate: any, i: number) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-3 py-2 text-slate-700">{rate.role || rate.item}</td>
                            <td className="px-3 py-2 text-right font-medium">${rate.rate}</td>
                            <td className="px-3 py-2 text-slate-500">{rate.unit || 'hr'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Financial Analysis" 
              icon={DollarSign}
              onRequestAnalysis={() => handleRequestAnalysis('financial')}
            />
          )}
        </AnalysisSection>

        {/* Obligations */}
        <AnalysisSection
          title="Obligations & Milestones"
          description="Contractual obligations and key dates"
          icon={ListChecks}
          iconColor="bg-gradient-to-br from-purple-500 to-fuchsia-500"
          bgGradient="bg-gradient-to-r from-purple-500 to-fuchsia-500"
          badge={stats.obligationCount > 0 ? `${stats.obligationCount} tracked` : undefined}
          status={data.obligations ? 'complete' : 'missing'}
          defaultExpanded={activeView === 'detailed'}
        >
          {data.obligations ? (
            <div className="space-y-3">
              {(data.obligations.obligations || []).slice(0, 5).map((obligation: any, i: number) => (
                <div 
                  key={i}
                  className={cn(
                    "p-3 rounded-lg border flex items-center gap-3",
                    obligation.status === 'overdue' && "bg-rose-50 border-rose-200",
                    obligation.status === 'due' && "bg-amber-50 border-amber-200",
                    obligation.status === 'completed' && "bg-emerald-50 border-emerald-200",
                    !obligation.status && "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    obligation.status === 'overdue' && "bg-rose-100",
                    obligation.status === 'due' && "bg-amber-100",
                    obligation.status === 'completed' && "bg-emerald-100",
                    !obligation.status && "bg-slate-100"
                  )}>
                    {obligation.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : obligation.status === 'overdue' ? (
                      <AlertCircle className="h-4 w-4 text-rose-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">
                      {obligation.title || obligation.obligation || 'Obligation'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {obligation.party && `${obligation.party} • `}
                      {obligation.dueDate && new Date(obligation.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Obligations" 
              icon={ListChecks}
              onRequestAnalysis={() => handleRequestAnalysis('obligations')}
            />
          )}
        </AnalysisSection>

        {/* Renewal Terms */}
        <AnalysisSection
          title="Renewal Terms"
          description="Auto-renewal, termination, and renewal conditions"
          icon={RefreshCw}
          iconColor="bg-gradient-to-br from-teal-500 to-cyan-500"
          bgGradient="bg-gradient-to-r from-teal-500 to-cyan-500"
          status={data.renewal ? 'complete' : 'missing'}
          defaultExpanded={activeView === 'detailed'}
        >
          {data.renewal ? (
            <div className="space-y-4">
              {/* Auto-renewal Status */}
              <div className={cn(
                "p-4 rounded-lg border flex items-center gap-4",
                data.renewal.autoRenewal ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  data.renewal.autoRenewal ? "bg-amber-100" : "bg-slate-100"
                )}>
                  <RefreshCw className={cn(
                    "h-6 w-6",
                    data.renewal.autoRenewal ? "text-amber-600" : "text-slate-400"
                  )} />
                </div>
                <div>
                  <p className="font-medium text-slate-800">
                    {data.renewal.autoRenewal ? 'Auto-Renewal Active' : 'Manual Renewal'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {data.renewal.autoRenewal 
                      ? `Contract renews automatically. Notice required: ${data.renewal.renewalTerms?.noticePeriodDays || 30} days`
                      : 'This contract requires manual renewal action'}
                  </p>
                </div>
              </div>
              
              {/* Term End Date */}
              {data.renewal.currentTermEnd && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">Term End Date</p>
                    <p className="text-sm text-slate-500">
                      {new Date(data.renewal.currentTermEnd).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyAnalysisState 
              section="Renewal Terms" 
              icon={RefreshCw}
              onRequestAnalysis={() => handleRequestAnalysis('renewal')}
            />
          )}
        </AnalysisSection>
          </>
        )}
      </div>

      {/* AI Chat CTA */}
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <MessageSquare className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold text-slate-800 mb-1">Have questions about this analysis?</h3>
              <p className="text-sm text-slate-600">
                Ask our AI assistant for clarification, deeper analysis, or specific insights about this contract.
              </p>
            </div>
            <Button 
              className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              onClick={() => handleRequestAnalysis('any questions')}
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ComprehensiveAIAnalysis

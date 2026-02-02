'use client'

import React, { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  FileText,
  Shield,
  ChevronRight,
  Target,
  Zap,
  Brain,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

interface AIInsight {
  id: string
  type: 'summary' | 'risk' | 'opportunity' | 'obligation' | 'recommendation' | 'key_term' | 'anomaly'
  title: string
  content: string
  confidence: number
  importance: 'high' | 'medium' | 'low'
  actionable?: boolean
  action?: {
    label: string
    onClick: () => void
  }
}

interface AIInsightsSummaryCardProps {
  insights: AIInsight[]
  contractSummary?: string
  keyTerms?: Array<{ term: string; value: string }>
  extractionDate?: Date
  isRefreshing?: boolean
  onRefresh?: () => void
  onViewAll?: () => void
  className?: string
}

const InsightIcon = ({ type }: { type: AIInsight['type'] }) => {
  const iconClass = "h-4 w-4"
  switch (type) {
    case 'summary': return <FileText className={iconClass} />
    case 'risk': return <AlertTriangle className={iconClass} />
    case 'opportunity': return <TrendingUp className={iconClass} />
    case 'obligation': return <Target className={iconClass} />
    case 'recommendation': return <Lightbulb className={iconClass} />
    case 'key_term': return <Zap className={iconClass} />
    case 'anomaly': return <Shield className={iconClass} />
    default: return <Brain className={iconClass} />
  }
}

const InsightBadge = ({ type }: { type: AIInsight['type'] }) => {
  const config = {
    summary: { label: 'Summary', className: 'bg-blue-100 text-blue-700' },
    risk: { label: 'Risk', className: 'bg-red-100 text-red-700' },
    opportunity: { label: 'Opportunity', className: 'bg-emerald-100 text-emerald-700' },
    obligation: { label: 'Obligation', className: 'bg-amber-100 text-amber-700' },
    recommendation: { label: 'Tip', className: 'bg-violet-100 text-violet-700' },
    key_term: { label: 'Key Term', className: 'bg-indigo-100 text-indigo-700' },
    anomaly: { label: 'Anomaly', className: 'bg-orange-100 text-orange-700' },
  }[type]
  
  return (
    <Badge className={cn("text-[10px] border-0", config.className)}>
      {config.label}
    </Badge>
  )
}

export const AIInsightsSummaryCard = memo(function AIInsightsSummaryCard({
  insights,
  contractSummary,
  keyTerms,
  extractionDate,
  isRefreshing = false,
  onRefresh,
  onViewAll,
  className,
}: AIInsightsSummaryCardProps) {
  
  // Sort insights by importance
  const sortedInsights = useMemo(() => {
    return [...insights].sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 }
      return importanceOrder[a.importance] - importanceOrder[b.importance]
    }).slice(0, 4) // Show top 4 insights
  }, [insights])
  
  // Group by type for quick stats
  const insightStats = useMemo(() => {
    const stats = {
      risks: insights.filter(i => i.type === 'risk').length,
      opportunities: insights.filter(i => i.type === 'opportunity').length,
      obligations: insights.filter(i => i.type === 'obligation').length,
      total: insights.length,
    }
    return stats
  }, [insights])
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-sm bg-white",
      className
    )}>
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 via-purple-50 to-indigo-50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
                AI Insights
                {insights.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {insights.length} found
                  </Badge>
                )}
              </h3>
              {extractionDate && (
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                  Last analyzed {new Date(extractionDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          
          {onRefresh && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isRefreshing && "animate-spin")} />
              {isRefreshing ? 'Analyzing...' : 'Refresh'}
            </Button>
          )}
        </div>
        
        {/* Quick Stats */}
        {insightStats.total > 0 && (
          <div className="flex items-center gap-3 mt-3">
            {insightStats.risks > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{insightStats.risks} risk{insightStats.risks > 1 ? 's' : ''}</span>
              </div>
            )}
            {insightStats.opportunities > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{insightStats.opportunities} opportunit{insightStats.opportunities > 1 ? 'ies' : 'y'}</span>
              </div>
            )}
            {insightStats.obligations > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                <Target className="h-3.5 w-3.5" />
                <span>{insightStats.obligations} obligation{insightStats.obligations > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 sm:p-5">
        {/* Contract Summary */}
        {contractSummary && (
          <div className="mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Summary
              </span>
              <button
                onClick={() => copyToClipboard(contractSummary)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
              {contractSummary}
            </p>
          </div>
        )}
        
        {/* Key Terms */}
        {keyTerms && keyTerms.length > 0 && (
          <div className="mb-4 pb-4 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">
              Key Terms
            </span>
            <div className="flex flex-wrap gap-2">
              {keyTerms.slice(0, 6).map((item, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-100"
                >
                  <span className="text-[10px] sm:text-xs font-medium text-slate-600">{item.term}:</span>
                  <span className="text-[10px] sm:text-xs text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Insights List */}
        {sortedInsights.length > 0 ? (
          <div className="space-y-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block">
              Top Insights
            </span>
            <AnimatePresence mode="popLayout">
              {sortedInsights.map((insight, idx) => (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-3 rounded-lg border transition-colors",
                    insight.importance === 'high' 
                      ? "bg-amber-50/50 border-amber-100 hover:bg-amber-50"
                      : "bg-slate-50/50 border-slate-100 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-1.5 rounded-md",
                      insight.type === 'risk' ? "bg-red-100 text-red-600" :
                      insight.type === 'opportunity' ? "bg-emerald-100 text-emerald-600" :
                      insight.type === 'obligation' ? "bg-amber-100 text-amber-600" :
                      "bg-violet-100 text-violet-600"
                    )}>
                      <InsightIcon type={insight.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs sm:text-sm font-medium text-slate-900">
                          {insight.title}
                        </span>
                        <InsightBadge type={insight.type} />
                        {insight.importance === 'high' && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">
                            Important
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {insight.content}
                      </p>
                      {insight.actionable && insight.action && (
                        <button
                          onClick={insight.action.onClick}
                          className="mt-2 text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                        >
                          {insight.action.label}
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        insight.confidence >= 0.8 ? "bg-emerald-500" :
                        insight.confidence >= 0.6 ? "bg-amber-500" :
                        "bg-slate-400"
                      )} />
                      <span className="text-[10px] text-slate-400">
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="p-3 rounded-full bg-slate-100 inline-flex mb-3">
              <Brain className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 mb-2">No AI insights yet</p>
            <p className="text-xs text-slate-400">
              Run AI extraction to generate insights
            </p>
          </div>
        )}
        
        {/* View All Button */}
        {insights.length > 4 && onViewAll && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAll}
            className="w-full mt-4 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
          >
            View all {insights.length} insights
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </Card>
  )
})

export default AIInsightsSummaryCard

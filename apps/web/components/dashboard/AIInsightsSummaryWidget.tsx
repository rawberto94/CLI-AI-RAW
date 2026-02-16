'use client'

/**
 * AI Insights Summary Widget
 * 
 * Dashboard widget displaying AI-powered insights across the contract portfolio.
 * Shows extraction accuracy, risk detection, recommendations, and trends.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Target,
  Zap,
  ChevronRight,
  RefreshCw,
  BarChart3,
  Clock,
  FileText,
  DollarSign,
  Shield,
  Eye,
  ArrowRight,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export type InsightCategory = 'risk' | 'opportunity' | 'compliance' | 'optimization' | 'trend' | 'alert'
export type InsightPriority = 'critical' | 'high' | 'medium' | 'low'

export interface AIInsight {
  id: string
  category: InsightCategory
  priority: InsightPriority
  title: string
  description: string
  metric?: {
    value: number
    label: string
    change?: number
    unit?: string
  }
  action?: {
    label: string
    href?: string
    onClick?: () => void
  }
  affectedContracts?: number
  confidence: number
  generatedAt: Date
}

export interface AIMetrics {
  extractionAccuracy: number
  riskDetectionRate: number
  processingSpeed: number // contracts per hour
  costSavingsIdentified: number
  anomaliesDetected: number
  recommendationsGenerated: number
  contractsAnalyzed: number
  avgConfidence: number
}

interface AIInsightsSummaryWidgetProps {
  insights?: AIInsight[]
  metrics?: AIMetrics
  onRefresh?: () => void
  onViewInsight?: (id: string) => void
  maxInsights?: number
  showMetrics?: boolean
  className?: string
  variant?: 'card' | 'compact'
}

// ============ HELPERS ============

const CATEGORY_CONFIG = {
  risk: { 
    icon: AlertTriangle, 
    color: 'text-red-600', 
    bg: 'bg-red-50',
    label: 'Risk Alert'
  },
  opportunity: { 
    icon: Lightbulb, 
    color: 'text-green-600', 
    bg: 'bg-green-50',
    label: 'Opportunity'
  },
  compliance: { 
    icon: Shield, 
    color: 'text-violet-600', 
    bg: 'bg-violet-50',
    label: 'Compliance'
  },
  optimization: { 
    icon: Target, 
    color: 'text-violet-600', 
    bg: 'bg-violet-50',
    label: 'Optimization'
  },
  trend: { 
    icon: TrendingUp, 
    color: 'text-violet-600', 
    bg: 'bg-violet-50',
    label: 'Trend'
  },
  alert: { 
    icon: Zap, 
    color: 'text-amber-600', 
    bg: 'bg-amber-50',
    label: 'Alert'
  },
}

const PRIORITY_CONFIG = {
  critical: { color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
  high: { color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
  medium: { color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
  low: { color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `CHF ${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `CHF ${(value / 1000).toFixed(0)}K`
  return `CHF ${value}`
}

const formatPercentage = (value: number): string => `${value.toFixed(1)}%`

// ============ SUB-COMPONENTS ============

interface MetricCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  change?: number
  color: string
}

function MetricCard({ icon: Icon, label, value, change, color }: MetricCardProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
      <div className={cn("p-1.5 rounded-md", color)}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-500 truncate">{label}</div>
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold text-slate-900">{value}</span>
          {change !== undefined && (
            <span className={cn(
              "text-[10px] font-medium",
              change >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {change >= 0 ? '+' : ''}{change}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

interface InsightItemProps {
  insight: AIInsight
  onView?: (id: string) => void
  compact?: boolean
}

function InsightItem({ insight, onView, compact = false }: InsightItemProps) {
  const categoryConfig = CATEGORY_CONFIG[insight.category]
  const priorityConfig = PRIORITY_CONFIG[insight.priority]
  const CategoryIcon = categoryConfig.icon
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group rounded-lg border transition-all hover:shadow-sm cursor-pointer",
        priorityConfig.border,
        compact ? "p-2" : "p-3"
      )}
      onClick={() => onView?.(insight.id)}
    >
      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className={cn("flex-shrink-0 rounded-lg p-2", categoryConfig.bg)}>
          <CategoryIcon className={cn("h-4 w-4", categoryConfig.color)} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium",
              compact ? "text-xs" : "text-sm"
            )}>
              {insight.title}
            </span>
            <Badge className={cn("text-[10px]", priorityConfig.bg, priorityConfig.color)}>
              {insight.priority}
            </Badge>
          </div>
          
          {!compact && (
            <>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {insight.description}
              </p>
              
              <div className="flex items-center gap-3 mt-2">
                {insight.metric && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-medium text-slate-900">
                      {insight.metric.value}{insight.metric.unit}
                    </span>
                    <span className="text-slate-500">{insight.metric.label}</span>
                    {insight.metric.change !== undefined && (
                      <span className={cn(
                        "text-[10px]",
                        insight.metric.change >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        ({insight.metric.change >= 0 ? '+' : ''}{insight.metric.change}%)
                      </span>
                    )}
                  </div>
                )}
                
                {insight.affectedContracts && (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <FileText className="h-3 w-3" />
                    {insight.affectedContracts} contracts
                  </div>
                )}
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Brain className="h-3 w-3" />
                        {Math.round(insight.confidence * 100)}%
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>AI confidence score</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          )}
        </div>
        
        {/* Action */}
        {insight.action && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {insight.action.href ? (
              <Link href={insight.action.href}>
                <Button variant="ghost" size="sm" className="h-7 px-2">
                  {insight.action.label}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2"
                onClick={(e) => { e.stopPropagation(); insight.action?.onClick?.() }}
              >
                {insight.action.label}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ============ AI PERFORMANCE RING ============

interface PerformanceRingProps {
  value: number
  label: string
  color: string
}

function PerformanceRing({ value, label, color }: PerformanceRingProps) {
  const radius = 30
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-slate-100"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-slate-900">{Math.round(value)}%</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 mt-1 text-center">{label}</span>
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function AIInsightsSummaryWidget({
  insights = [],
  metrics,
  onRefresh,
  onViewInsight,
  maxInsights = 5,
  showMetrics = true,
  className,
  variant = 'card',
}: AIInsightsSummaryWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await onRefresh?.()
    setTimeout(() => setIsRefreshing(false), 1000)
  }
  
  // Sort insights by priority
  const sortedInsights = [...insights]
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })
    .slice(0, maxInsights)
  
  const hasMore = insights.length > maxInsights
  
  // Count by category
  const categoryCount = insights.reduce((acc, i) => {
    acc[i.category] = (acc[i.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            AI Insights
            <Badge variant="secondary" className="ml-2">
              {insights.length}
            </Badge>
          </CardTitle>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Performance metrics */}
        {showMetrics && metrics && (
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-700">AI Performance</span>
              <Badge variant="outline" className="text-[10px]">
                {metrics.contractsAnalyzed} analyzed
              </Badge>
            </div>
            
            <div className="flex items-center justify-around">
              <PerformanceRing 
                value={metrics.extractionAccuracy} 
                label="Extraction"
                color="text-violet-500"
              />
              <PerformanceRing 
                value={metrics.riskDetectionRate} 
                label="Risk Detection"
                color="text-amber-500"
              />
              <PerformanceRing 
                value={metrics.avgConfidence} 
                label="Confidence"
                color="text-violet-500"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-3">
              <MetricCard 
                icon={DollarSign}
                label="Savings Found"
                value={formatCurrency(metrics.costSavingsIdentified)}
                color="bg-green-500"
              />
              <MetricCard 
                icon={AlertTriangle}
                label="Anomalies"
                value={metrics.anomaliesDetected}
                color="bg-amber-500"
              />
              <MetricCard 
                icon={Lightbulb}
                label="Recommendations"
                value={metrics.recommendationsGenerated}
                color="bg-violet-500"
              />
            </div>
          </div>
        )}
        
        {/* Category summary */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {Object.entries(categoryCount).map(([category, count]) => {
            const config = CATEGORY_CONFIG[category as InsightCategory]
            const Icon = config.icon
            return (
              <Badge 
                key={category}
                variant="outline" 
                className={cn("flex-shrink-0 gap-1", config.bg, config.color)}
              >
                <Icon className="h-3 w-3" />
                {count} {config.label}
              </Badge>
            )
          })}
        </div>
        
        {/* Insights list */}
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No insights yet</p>
            <p className="text-xs text-slate-400 mt-1">
              AI will generate insights as you add contracts
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {sortedInsights.map(insight => (
                <InsightItem
                  key={insight.id}
                  insight={insight}
                  onView={onViewInsight}
                  compact={variant === 'compact'}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {hasMore && (
          <div className="mt-4 pt-4 border-t">
            <Link href="/insights">
              <Button variant="ghost" className="w-full justify-center text-sm">
                View all {insights.length} insights
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AIInsightsSummaryWidget

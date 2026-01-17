'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertTriangle,
  CheckCircle2,
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export interface ScoreBreakdownItem {
  label: string
  score: number | null
  maxScore: number
  status: 'good' | 'warning' | 'critical' | 'unknown'
  description?: string
  details?: string[]
}

export interface RiskInfo {
  level?: 'low' | 'medium' | 'high' | 'unknown'
  riskLevel?: 'low' | 'medium' | 'high' | 'unknown'
  score?: number
  riskScore?: number
  factors?: string[]
  risks?: Array<{ title: string; description?: string; severity?: string }>
  mitigations?: string[]
}

export interface ComplianceInfo {
  compliant?: boolean | null
  isCompliant?: boolean | null
  score?: number
  violations?: string[]
  requirements?: string[]
  checks?: Array<{ name: string; status: string; message?: string }>
}

export interface HealthInfo {
  score: number
  completeness: number
  issues?: Array<{
    type: string
    severity: 'low' | 'medium' | 'high'
    message: string
  }>
}

export interface ContractScoresCardProps {
  riskInfo?: RiskInfo | null
  complianceInfo?: ComplianceInfo | null
  healthInfo?: HealthInfo | null
  extractionConfidence?: number
  isProcessing?: boolean
  onRefresh?: () => void
  className?: string
}

// ============ HELPERS ============

const getRiskColor = (level: string) => {
  switch (level) {
    case 'low': return { text: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-200', progress: 'bg-green-500' }
    case 'medium': return { text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-200', progress: 'bg-amber-500' }
    case 'high': return { text: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-200', progress: 'bg-red-500' }
    default: return { text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200', progress: 'bg-slate-400' }
  }
}

const getComplianceColor = (compliant: boolean | null) => {
  if (compliant === true) return { text: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-200' }
  if (compliant === false) return { text: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-200' }
  return { text: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' }
}

const getHealthColor = (score: number) => {
  if (score >= 80) return { text: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-200', progress: 'bg-green-500' }
  if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-200', progress: 'bg-amber-500' }
  return { text: 'text-red-600', bg: 'bg-red-500/10', border: 'border-red-200', progress: 'bg-red-500' }
}

// ============ SCORE CARD COMPONENT ============

interface ScoreCardProps {
  title: string
  icon: React.ReactNode
  value: string | number
  subtitle?: string
  score?: number
  maxScore?: number
  colorScheme: { text: string; bg: string; border: string; progress?: string }
  details?: React.ReactNode
  explanation: string
  className?: string
}

function ScoreCard({ title, icon, value, subtitle, score, maxScore = 100, colorScheme, details, explanation, className }: ScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div className={cn("rounded-xl border overflow-hidden transition-all", colorScheme.bg, colorScheme.border, className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 text-left hover:bg-white/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className={cn("flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center", colorScheme.bg, colorScheme.border, "border")}>
                {icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-600">{title}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-2xl font-bold", colorScheme.text)}>{value}</span>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  </div>
                </div>
                
                {subtitle && (
                  <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
                )}
                
                {score !== undefined && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", colorScheme.progress)}
                        style={{ width: `${Math.min(100, Math.max(0, (score / maxScore) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t border-dashed">
            <div className="flex items-start gap-2 p-3 bg-white/60 rounded-lg">
              <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-600 font-medium mb-1">How is this calculated?</p>
                <p className="text-xs text-slate-500">{explanation}</p>
              </div>
            </div>
            
            {details && (
              <div className="mt-3">
                {details}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function ContractScoresCard({
  riskInfo,
  complianceInfo,
  healthInfo,
  extractionConfidence,
  isProcessing,
  onRefresh,
  className,
}: ContractScoresCardProps) {
  // Normalize risk info to handle different formats from the hook
  const riskLevel = riskInfo?.level || riskInfo?.riskLevel || 'unknown'
  const riskScore = riskInfo?.score ?? riskInfo?.riskScore ?? (riskLevel === 'low' ? 25 : riskLevel === 'medium' ? 50 : riskLevel === 'high' ? 75 : 0)
  const riskFactors = riskInfo?.factors || riskInfo?.risks?.map(r => r.title) || []
  
  // Normalize compliance info
  const isCompliant = complianceInfo?.compliant ?? complianceInfo?.isCompliant ?? null
  const complianceScore = complianceInfo?.score ?? (isCompliant === true ? 100 : isCompliant === false ? 0 : 50)
  const complianceIssues = complianceInfo?.violations || complianceInfo?.checks?.filter(c => c.status !== 'passed').map(c => c.message || c.name) || []
  
  const riskColors = getRiskColor(riskLevel)
  const complianceColors = getComplianceColor(isCompliant)
  const healthColors = getHealthColor(healthInfo?.score ?? 100)
  
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-indigo-600" />
              Contract Scores & Assessment
            </CardTitle>
            <CardDescription className="mt-1">
              AI-derived scores based on contract analysis
            </CardDescription>
          </div>
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isProcessing}
              className="text-slate-500"
            >
              <RefreshCw className={cn("h-4 w-4", isProcessing && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-3">
        {/* Extraction Confidence */}
        {extractionConfidence !== undefined && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <span className="text-sm text-slate-600">AI Extraction Confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-20 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                  style={{ width: `${extractionConfidence}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-violet-600">{extractionConfidence}%</span>
            </div>
          </div>
        )}
        
        {/* Risk Score */}
        <ScoreCard
          title="Risk Level"
          icon={<AlertTriangle className={cn("h-5 w-5", riskColors.text)} />}
          value={riskLevel ? riskLevel.toUpperCase() : 'Unknown'}
          subtitle={riskScore ? `Score: ${riskScore}/100` : undefined}
          score={riskScore}
          colorScheme={riskColors}
          explanation="Risk is calculated based on extracted risk factors including liability clauses, indemnification terms, termination conditions, and penalty provisions. Higher scores indicate more risk factors detected."
          details={
            riskFactors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Risk Factors Detected:</p>
                <ul className="space-y-1">
                  {riskFactors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                      {factor}
                    </li>
                  ))}
                </ul>
                {riskInfo?.mitigations && riskInfo.mitigations.length > 0 && (
                  <>
                    <p className="text-xs font-medium text-slate-600 mt-3">Suggested Mitigations:</p>
                    <ul className="space-y-1">
                      {riskInfo.mitigations.map((mitigation, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-green-500" />
                          {mitigation}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )
          }
        />
        
        {/* Compliance Score */}
        <ScoreCard
          title="Compliance Status"
          icon={<Scale className={cn("h-5 w-5", complianceColors.text)} />}
          value={isCompliant === true ? 'Compliant' : isCompliant === false ? 'Non-Compliant' : 'Unknown'}
          subtitle={complianceScore ? `Confidence: ${complianceScore}%` : undefined}
          score={complianceScore}
          colorScheme={complianceColors}
          explanation="Compliance is determined by checking contract terms against standard regulatory requirements, company policies, and industry standards. The score reflects confidence in the compliance assessment."
          details={
            complianceIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Compliance Issues:</p>
                <ul className="space-y-1">
                  {complianceIssues.map((violation, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                      {violation}
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
        
        {/* Health Score */}
        <ScoreCard
          title="Contract Health"
          icon={<Activity className={cn("h-5 w-5", healthColors.text)} />}
          value={`${healthInfo?.score ?? 100}%`}
          subtitle={healthInfo?.completeness ? `${healthInfo.completeness}% metadata complete` : undefined}
          score={healthInfo?.score ?? 100}
          colorScheme={healthColors}
          explanation="Health score is calculated from: base score of 100, minus deductions for detected issues (high severity: -20, medium: -10, low: -5), plus bonuses for established parent (+5) and child (+5) relationships."
          details={
            healthInfo?.issues && healthInfo.issues.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Issues Affecting Score:</p>
                <ul className="space-y-1.5">
                  {healthInfo.issues.map((issue, idx) => (
                    <li key={idx} className={cn(
                      "flex items-start gap-2 p-2 rounded text-xs",
                      issue.severity === 'high' && 'bg-red-50 text-red-700',
                      issue.severity === 'medium' && 'bg-amber-50 text-amber-700',
                      issue.severity === 'low' && 'bg-blue-50 text-blue-700'
                    )}>
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">{issue.type}:</span> {issue.message}
                        <span className="ml-2 opacity-60">
                          ({issue.severity === 'high' ? '-20' : issue.severity === 'medium' ? '-10' : '-5'} points)
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          }
        />
        
        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Recalculating scores...</span>
          </div>
        )}
        
        {/* Legend/Help */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5" />
              Click each score to see detailed breakdown
            </span>
            <span>Scores are automatically updated when contract changes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ContractScoresCard

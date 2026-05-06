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

// ============ COMPACT TILE ============

interface CompactTileProps {
  label: string
  value: string
  icon: React.ReactNode
  percent: number
  active: boolean
  onClick: () => void
  colorScheme: { text: string; bg: string; border: string; progress?: string }
}

function CompactTile({ label, value, icon, percent, active, onClick, colorScheme }: CompactTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
        "hover:bg-slate-50",
        active ? "ring-2 ring-violet-400 border-violet-300 bg-white" : "border-slate-200 bg-white"
      )}
    >
      <div className={cn("flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center", colorScheme.bg)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-medium truncate">{label}</span>
          <span className={cn("text-sm font-semibold tabular-nums", colorScheme.text)}>{value}</span>
        </div>
        <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", colorScheme.progress ?? 'bg-slate-400')}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      </div>
    </button>
  )
}

// ============ MAIN COMPONENT ============

type MetricKey = 'extraction' | 'risk' | 'compliance' | 'health'

export function ContractScoresCard({
  riskInfo,
  complianceInfo,
  healthInfo,
  extractionConfidence,
  isProcessing,
  onRefresh,
  className,
}: ContractScoresCardProps) {
  const [active, setActive] = useState<MetricKey | null>(null)

  // Normalize risk info
  const riskLevel = riskInfo?.level || riskInfo?.riskLevel || 'unknown'
  const riskScore = riskInfo?.score ?? riskInfo?.riskScore ?? (riskLevel === 'low' ? 25 : riskLevel === 'medium' ? 50 : riskLevel === 'high' ? 75 : 0)
  const riskFactors = riskInfo?.factors || riskInfo?.risks?.map(r => r.title) || []

  // Normalize compliance info
  const isCompliant = complianceInfo?.compliant ?? complianceInfo?.isCompliant ?? null
  const complianceScore = complianceInfo?.score ?? (isCompliant === true ? 100 : isCompliant === false ? 0 : 50)
  const complianceIssues = complianceInfo?.violations || complianceInfo?.checks?.filter(c => c.status !== 'passed').map(c => c.message || c.name) || []

  const healthScore = healthInfo?.score ?? 100

  const riskColors = getRiskColor(riskLevel)
  const complianceColors = getComplianceColor(isCompliant)
  const healthColors = getHealthColor(healthScore)
  const extractionColors = { text: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-200', progress: 'bg-gradient-to-r from-violet-500 to-purple-500' }

  const toggle = (k: MetricKey) => setActive(prev => (prev === k ? null : k))

  return (
    <Card className={cn("overflow-hidden border-slate-200", className)}>
      <CardHeader className="py-2.5 px-4 border-b bg-slate-50/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Activity className="h-4 w-4 text-violet-600" />
            <span>Scores & Assessment</span>
            {isProcessing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 ml-1" />}
          </div>
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isProcessing}
              className="h-7 w-7 p-0 text-slate-500"
              aria-label="Refresh scores"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isProcessing && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {extractionConfidence !== undefined && (
            <CompactTile
              label="Extraction"
              value={`${extractionConfidence}%`}
              icon={<Sparkles className="h-3.5 w-3.5 text-violet-600" />}
              percent={extractionConfidence}
              active={active === 'extraction'}
              onClick={() => toggle('extraction')}
              colorScheme={extractionColors}
            />
          )}
          <CompactTile
            label="Risk"
            value={riskLevel === 'unknown' ? '—' : riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
            icon={<AlertTriangle className={cn("h-3.5 w-3.5", riskColors.text)} />}
            percent={riskScore}
            active={active === 'risk'}
            onClick={() => toggle('risk')}
            colorScheme={riskColors}
          />
          <CompactTile
            label="Compliance"
            value={isCompliant === true ? 'OK' : isCompliant === false ? 'Issues' : '—'}
            icon={<Scale className={cn("h-3.5 w-3.5", complianceColors.text)} />}
            percent={complianceScore}
            active={active === 'compliance'}
            onClick={() => toggle('compliance')}
            colorScheme={{ ...complianceColors, progress: isCompliant === true ? 'bg-green-500' : isCompliant === false ? 'bg-red-500' : 'bg-slate-400' }}
          />
          <CompactTile
            label="Health"
            value={`${healthScore}%`}
            icon={<Activity className={cn("h-3.5 w-3.5", healthColors.text)} />}
            percent={healthScore}
            active={active === 'health'}
            onClick={() => toggle('health')}
            colorScheme={healthColors}
          />
        </div>

        {active && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border text-xs text-slate-600 space-y-2">
            {active === 'extraction' && (
              <>
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> AI Extraction Confidence
                </p>
                <p>
                  Confidence that AI-extracted metadata (parties, dates, values, clauses) is accurate. Low confidence
                  suggests reviewing extraction results manually.
                </p>
              </>
            )}
            {active === 'risk' && (
              <>
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Risk Level — {riskScore}/100
                </p>
                <p>
                  Based on liability, indemnification, termination, and penalty provisions detected in the contract.
                </p>
                {riskFactors.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {riskFactors.slice(0, 6).map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {riskInfo?.mitigations && riskInfo.mitigations.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {riskInfo.mitigations.slice(0, 4).map((m, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {active === 'compliance' && (
              <>
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Compliance — {complianceScore}% confidence
                </p>
                <p>
                  Checks contract terms against regulatory requirements, company policies, and industry standards.
                </p>
                {complianceIssues.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {complianceIssues.slice(0, 6).map((v, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                        <span>{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {active === 'health' && (
              <>
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Contract Health — {healthScore}%
                  {healthInfo?.completeness !== undefined && (
                    <span className="text-slate-500 font-normal">· {healthInfo.completeness}% metadata complete</span>
                  )}
                </p>
                <p>
                  Base 100 minus issue deductions (high −20, medium −10, low −5) plus relationship bonuses (+5 each).
                </p>
                {healthInfo?.issues && healthInfo.issues.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {healthInfo.issues.slice(0, 8).map((issue, i) => (
                      <li key={i} className={cn(
                        "flex items-start gap-1.5 px-2 py-1 rounded",
                        issue.severity === 'high' && 'bg-red-50 text-red-700',
                        issue.severity === 'medium' && 'bg-amber-50 text-amber-700',
                        issue.severity === 'low' && 'bg-violet-50 text-violet-700'
                      )}>
                        <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span><span className="font-medium">{issue.type}:</span> {issue.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <p className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          Click a tile for details
        </p>
      </CardContent>
    </Card>
  )
}

export default ContractScoresCard

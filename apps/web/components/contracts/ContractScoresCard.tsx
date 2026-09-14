'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  HelpCircle,
  RefreshCw,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { detailUi } from '@/app/contracts/[id]/components/detail-ui'
import { describeHeaderCompliance, type HeaderComplianceInfo } from '@/lib/contracts/header-compliance'
import { AnalysisCoverageChip, type AnalysisPackSummary } from '@/components/contracts/AnalysisCoverageChip'
import { FindingSourceLink } from '@/components/contracts/FindingSourceLink'

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
  risks?: Array<{ title?: string; description?: string; severity?: string; sourceClause?: string; source?: string }>
  mitigations?: string[]
}

export type ComplianceInfo = HeaderComplianceInfo & {
  compliant?: boolean | null
  requirements?: string[]
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
  analysisPack?: AnalysisPackSummary | null
  ocrNeedsReview?: boolean
  analysisLanguage?: string | null
  scanType?: 'native' | 'scanned' | 'mixed' | string | null
  contractId?: string
  isProcessing?: boolean
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
                    <span className={cn("text-sm font-semibold leading-5 tabular-nums", colorScheme.text)}>{value}</span>
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
          <span className="text-xs uppercase tracking-wide text-slate-500 font-medium leading-4 truncate">{label}</span>
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

type MetricKey = 'risk' | 'compliance' | 'health'

export function ContractScoresCard({
  riskInfo,
  complianceInfo,
  healthInfo,
  analysisPack,
  ocrNeedsReview,
  analysisLanguage,
  scanType,
  contractId,
  isProcessing,
  className,
}: ContractScoresCardProps) {
  const [active, setActive] = useState<MetricKey | null>(null)

  // Normalize risk info — never invent a score when nothing was assessed
  const riskLevel = riskInfo?.level || riskInfo?.riskLevel || 'unknown'
  const explicitRiskScore = riskInfo?.score ?? riskInfo?.riskScore
  const riskAssessed = explicitRiskScore != null || riskLevel !== 'unknown' || (riskInfo?.factors?.length ?? 0) > 0 || (riskInfo?.risks?.length ?? 0) > 0
  const riskScore = explicitRiskScore ?? (riskLevel === 'low' ? 25 : riskLevel === 'medium' ? 50 : riskLevel === 'high' ? 75 : 0)
  const riskFactors = riskInfo?.factors || riskInfo?.risks?.map(r => r.title) || []

  // Normalize compliance info
  const isCompliant = complianceInfo?.compliant ?? complianceInfo?.isCompliant ?? null
  const complianceScore = complianceInfo?.score
  const complianceIssues = complianceInfo?.violations || complianceInfo?.checks?.filter(c => c.status !== 'passed').map(c => c.message || c.name) || []
  const complianceExplanation = complianceInfo
    ? describeHeaderCompliance(complianceInfo)
    : 'Compliance has not been assessed for this document.'

  const healthAssessed = healthInfo?.score != null
  const healthScore = healthInfo?.score ?? 0
  const compliancePercent = complianceScore ?? 0

  const riskColors = getRiskColor(riskLevel)
  const complianceColors = getComplianceColor(isCompliant)
  const healthColors = getHealthColor(healthScore)

  const toggle = (k: MetricKey) => setActive(prev => (prev === k ? null : k))

  return (
    <Card className={cn(detailUi.card, className)}>
      <CardHeader className={detailUi.cardHeader}>
        <div className="flex items-center justify-between gap-2">
          <div className={detailUi.cardTitle}>
            <Activity className="h-4 w-4 text-violet-500" />
            <span>Scores & Assessment</span>
            {isProcessing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 ml-1" />}
          </div>

        </div>
      </CardHeader>

      <CardContent className={cn(detailUi.cardContent, 'pt-3')}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
            percent={compliancePercent}
            active={active === 'compliance'}
            onClick={() => toggle('compliance')}
            colorScheme={{ ...complianceColors, progress: isCompliant === true ? 'bg-green-500' : isCompliant === false ? 'bg-red-500' : 'bg-slate-400' }}
          />
          <CompactTile
            label="Health"
            value={healthAssessed ? `${healthScore}%` : '—'}
            icon={<Activity className={cn("h-3.5 w-3.5", healthColors.text)} />}
            percent={healthScore}
            active={active === 'health'}
            onClick={() => toggle('health')}
            colorScheme={healthColors}
          />
        </div>

        {active && (
          <div className="mt-3 p-3 rounded-lg bg-slate-50 border text-xs text-slate-600 space-y-2">
            {active === 'risk' && (
              <>
                <p className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Risk Level — {riskAssessed ? `${riskScore}/100` : 'not assessed'}
                </p>
                <p>
                  {riskAssessed
                    ? (riskFactors.length > 0
                      ? `From this document's risk analysis (${riskFactors.length} factor${riskFactors.length === 1 ? '' : 's'}). Score is 0–100 from the RISK artifact, not a confidence percentage.`
                      : 'Score is 0–100 from this document\'s RISK artifact (liability, indemnification, termination, penalties). Not a model-confidence percentage.')
                    : 'Risk has not been assessed for this document yet.'}
                </p>
                {riskFactors.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {(riskInfo?.risks?.length ? riskInfo.risks : riskFactors.map((title) => ({ title }))).slice(0, 6).map((item, i) => {
                      const risk = typeof item === 'string' ? { title: item } : item
                      const label = risk.title || risk.description || riskFactors[i]
                      const snippet = risk.sourceClause || risk.source
                      return (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                        <span className="min-w-0">
                          <span>{label}</span>
                          {snippet && (
                            <FindingSourceLink
                              className="ml-1"
                              contractId={contractId}
                              snippet={snippet}
                              heading={risk.title}
                            />
                          )}
                        </span>
                      </li>
                      )
                    })}
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
                  <Info className="h-3.5 w-3.5" /> Compliance — {complianceScore == null ? 'not assessed' : `${complianceScore}%`}
                </p>
                <p>
                  {complianceExplanation}
                </p>
                {complianceIssues.length > 0 && (
                  <ul className="space-y-1 pt-1">
                    {(complianceInfo?.checks?.filter((c) => c.passed !== true).length
                      ? complianceInfo.checks.filter((c) => c.passed !== true)
                      : complianceIssues.map((message) => ({ name: message, message, status: 'failed' }))
                    ).slice(0, 6).map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertCircle className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" />
                        <span className="min-w-0">
                          <span>{item.message || item.name || complianceIssues[i]}</span>
                          <FindingSourceLink
                            className="ml-1"
                            contractId={contractId}
                            snippet={item.quote}
                            heading={item.name}
                            startOffset={item.startOffset}
                            endOffset={item.endOffset}
                          />
                        </span>
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

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-4 text-slate-400 flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Click a tile for details
          </p>
          <AnalysisCoverageChip pack={analysisPack} ocrNeedsReview={ocrNeedsReview} analysisLanguage={analysisLanguage} scanType={scanType} />
        </div>
      </CardContent>
    </Card>
  )
}

export default ContractScoresCard

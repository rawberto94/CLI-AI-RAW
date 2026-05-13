'use client'

import React, { memo, Suspense as _Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription as _CardDescription } from '@/components/ui/card'
import { Badge as _Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/design-tokens'
import {
  Sparkles,
  Users,
  Calendar,
  Building,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Bell,
} from 'lucide-react'
import { KeyTermBadge } from '@/components/contracts/detail/KeyTermBadge'

interface Party {
  id?: string
  legalName: string
  role?: string
  legalForm?: string
  name?: string // Legacy support
}

interface Risk {
  id?: string
  category: string
  description: string
  level?: string
}

interface SummaryTabProps {
  summary: string
  keyTerms?: string[]
  parties: Party[]
  signatureDate?: string
  startDate?: string
  endDate?: string
  noticePeriod?: string
  risks?: Risk[]
  riskLevel: 'low' | 'medium' | 'high'
}

const sectionCardClassName = 'flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.16)]'
const sectionHeaderClassName = 'flex min-h-[72px] flex-col justify-center border-b border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] px-5 py-4'
const sectionTitleClassName = 'flex items-center gap-2 text-sm font-semibold text-slate-800'
const sectionContentClassName = 'flex flex-1 flex-col px-5 py-5'

// Loading skeleton for lazy-loaded content
const SectionSkeleton = memo(function SectionSkeleton() {
  return (
    <Card className={sectionCardClassName}>
      <CardHeader className={cn(sectionHeaderClassName, 'pb-3')}>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className={sectionContentClassName}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
})

// Executive Summary Card
const ExecutiveSummary = memo(function ExecutiveSummary({
  summary,
  keyTerms,
}: { summary: string; keyTerms?: string[] }) {
  return (
    <Card className={sectionCardClassName}>
      <CardHeader className="flex min-h-[72px] flex-col justify-center border-b border-violet-100 bg-[linear-gradient(135deg,rgba(245,243,255,0.95),rgba(255,255,255,1))] px-5 py-4">
        <CardTitle className={sectionTitleClassName}>
          <Sparkles className="h-4 w-4 text-violet-500" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent className={sectionContentClassName}>
        <p className="text-sm text-slate-600 leading-relaxed">
          {summary || 'Contract summary will appear here once processing is complete.'}
        </p>
        
        {keyTerms && keyTerms.length > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Key Terms Identified
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keyTerms.map((term, i) => (
                <KeyTermBadge key={typeof term === 'string' ? term : ((term as Record<string, string>).name || (term as Record<string, string>).label || `term-${i}`)} term={term} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

// Parties Card
const PartiesCard = memo(function PartiesCard({ parties }: { parties: Party[] }) {
  if (!parties || parties.length === 0) {
    return (
      <Card className={sectionCardClassName}>
        <CardHeader className={sectionHeaderClassName}>
          <CardTitle className={sectionTitleClassName}>
            <Users className="h-4 w-4 text-violet-500" />
            Contract Parties
          </CardTitle>
        </CardHeader>
        <CardContent className={sectionContentClassName}>
          <p className="text-sm text-slate-500 py-4 text-center">No parties identified yet.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className={sectionCardClassName}>
      <CardHeader className={sectionHeaderClassName}>
        <CardTitle className={sectionTitleClassName}>
          <Users className="h-4 w-4 text-violet-500" />
          Contract Parties
        </CardTitle>
      </CardHeader>
      <CardContent className={sectionContentClassName}>
        <div className="space-y-3.5">
          {parties.map((party, i) => {
            const name = party.legalName || party.name || 'Unknown Party'
            const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '')
            
            return (
              <div 
                key={party.id || party.legalName || party.name || `party-${i}`}
                className={cn(
                  'flex min-h-[80px] items-center gap-3 rounded-2xl border px-4 py-3.5',
                  isClient ? "bg-violet-50 border-violet-100" : "bg-violet-50 border-violet-100"
                )}
              >
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  isClient ? "bg-violet-100" : "bg-violet-100"
                )}>
                  {isClient ? (
                    <Building className="h-4 w-4 text-violet-600" />
                  ) : (
                    <Users className="h-4 w-4 text-violet-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{name}</p>
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      "text-xs font-medium",
                      isClient ? "text-violet-600" : "text-violet-600"
                    )}>
                      {party.role || 'Party'}
                    </p>
                    {party.legalForm && (
                      <span className="text-xs text-slate-400">· {party.legalForm}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})

// Key Dates Card
const KeyDatesCard = memo(function KeyDatesCard({
  signatureDate,
  startDate,
  endDate,
  noticePeriod,
}: { signatureDate?: string; startDate?: string; endDate?: string; noticePeriod?: string }) {
  const isEvergreen = !endDate
  const daysRemaining = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
  const isExpiringSoon = daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 90
  const isExpired = daysRemaining !== null && daysRemaining < 0
  
  return (
    <Card className={sectionCardClassName}>
      <CardHeader className={sectionHeaderClassName}>
        <CardTitle className={sectionTitleClassName}>
          <Calendar className="h-4 w-4 text-violet-500" />
          Key Dates
        </CardTitle>
      </CardHeader>
      <CardContent className={sectionContentClassName}>
        <div className="space-y-3.5">
          {signatureDate && (
            <div className="flex min-h-[80px] items-center justify-between gap-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium text-slate-700">Signed</span>
              </div>
              <span className="shrink-0 text-right text-sm font-semibold text-violet-700">
                {formatDate(signatureDate)}
              </span>
            </div>
          )}
          
          <div className="flex min-h-[80px] items-center justify-between gap-4 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-slate-700">Start Date</span>
            </div>
            <span className="shrink-0 text-right text-sm font-semibold text-violet-700">
              {startDate ? formatDate(startDate) : '—'}
            </span>
          </div>
          
          <div className={cn(
            'flex min-h-[80px] items-center justify-between gap-4 rounded-2xl border px-4 py-3.5',
            isEvergreen ? "bg-violet-50 border-violet-100" :
            isExpired ? "bg-red-50 border-red-100" :
            isExpiringSoon ? "bg-amber-50 border-amber-200" : 
            "bg-slate-50 border-slate-100"
          )}>
            <div className="flex min-w-0 items-center gap-3">
              {isExpired ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : isExpiringSoon ? (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              ) : (
                <Calendar className="h-4 w-4 text-slate-500" />
              )}
              <div>
                <span className={cn(
                  "text-sm font-medium",
                  isEvergreen ? "text-violet-700" :
                  isExpired ? "text-red-700" :
                  isExpiringSoon ? "text-amber-700" : "text-slate-600"
                )}>
                  {isEvergreen ? 'Evergreen' : 'End Date'}
                </span>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <p className={cn(
                    "text-xs",
                    isExpiringSoon ? "text-amber-600" : "text-slate-500"
                  )}>
                    {daysRemaining} days remaining
                  </p>
                )}
              </div>
            </div>
            <span className={cn(
              'shrink-0 text-right text-sm font-semibold',
              isEvergreen ? "text-violet-700" :
              isExpired ? "text-red-700" :
              isExpiringSoon ? "text-amber-700" : "text-slate-700"
            )}>
              {endDate ? formatDate(endDate) : 'No end date'}
            </span>
          </div>
          
          {noticePeriod && !isExpired && (
            <div className="flex min-h-[80px] items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-3">
                <Bell className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Notice Period</span>
              </div>
              <span className="shrink-0 text-right text-sm font-medium text-slate-700">{noticePeriod}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

// Risks Card
const RisksCard = memo(function RisksCard({
  risks,
  riskLevel,
}: { risks?: Risk[]; riskLevel: 'low' | 'medium' | 'high' }) {
  if (!risks || risks.length === 0) return null
  
  return (
    <Card className={sectionCardClassName}>
      <CardHeader className={sectionHeaderClassName}>
        <div className="flex items-center justify-between">
          <CardTitle className={sectionTitleClassName}>
            <AlertTriangle className={cn(
              "h-4 w-4",
              riskLevel === 'low' ? 'text-violet-500' : 
              riskLevel === 'medium' ? 'text-amber-500' : 'text-red-500'
            )} />
            Key Risks
          </CardTitle>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            riskLevel === 'low' ? 'bg-violet-100 text-violet-700' : 
            riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          )}>
            {risks.length} identified
          </span>
        </div>
      </CardHeader>
      <CardContent className={sectionContentClassName}>
        <div className="space-y-3.5">
          {risks.slice(0, 3).map((risk, i) => (
            <div key={risk.id || `${risk.category}-${i}`} className="flex min-h-[76px] items-start gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                risk.level?.toLowerCase() === 'low' ? 'bg-violet-500' : 
                risk.level?.toLowerCase() === 'medium' ? 'bg-amber-500' : 'bg-red-500'
              )} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">{risk.category}</p>
                <p className="text-xs text-slate-500 line-clamp-2">{risk.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})

export const ContractSummaryTab = memo(function ContractSummaryTab(props: SummaryTabProps) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <ExecutiveSummary summary={props.summary} keyTerms={props.keyTerms} />
      
      <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
        <PartiesCard parties={props.parties} />
        <KeyDatesCard 
          signatureDate={props.signatureDate}
          startDate={props.startDate}
          endDate={props.endDate}
          noticePeriod={props.noticePeriod}
        />
      </div>
      
      <RisksCard risks={props.risks} riskLevel={props.riskLevel} />
    </div>
  )
})

export { SectionSkeleton }

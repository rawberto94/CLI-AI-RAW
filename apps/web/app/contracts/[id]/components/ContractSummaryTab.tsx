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

// Loading skeleton for lazy-loaded content
const SectionSkeleton = memo(function SectionSkeleton() {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
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
    <Card className="border-slate-200 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          {summary || 'Contract summary will appear here once processing is complete.'}
        </p>
        
        {keyTerms && keyTerms.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
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
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-500" />
            Contract Parties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 py-4 text-center">No parties identified yet.</p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-500" />
          Contract Parties
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {parties.map((party, i) => {
            const name = party.legalName || party.name || 'Unknown Party'
            const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '')
            
            return (
              <div 
                key={party.id || party.legalName || party.name || `party-${i}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  isClient ? "bg-violet-50 border-violet-100" : "bg-violet-50 border-violet-100"
                )}
              >
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
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
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-violet-500" />
          Key Dates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {signatureDate && (
            <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-medium text-slate-700">Signed</span>
              </div>
              <span className="text-sm font-semibold text-violet-700">
                {formatDate(signatureDate)}
              </span>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-medium text-slate-700">Start Date</span>
            </div>
            <span className="text-sm font-semibold text-violet-700">
              {startDate ? formatDate(startDate) : '—'}
            </span>
          </div>
          
          <div className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            isEvergreen ? "bg-violet-50 border-violet-100" :
            isExpired ? "bg-red-50 border-red-100" :
            isExpiringSoon ? "bg-amber-50 border-amber-200" : 
            "bg-slate-50 border-slate-100"
          )}>
            <div className="flex items-center gap-2">
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
              "text-sm font-semibold",
              isEvergreen ? "text-violet-700" :
              isExpired ? "text-red-700" :
              isExpiringSoon ? "text-amber-700" : "text-slate-700"
            )}>
              {endDate ? formatDate(endDate) : 'No end date'}
            </span>
          </div>
          
          {noticePeriod && !isExpired && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Notice Period</span>
              </div>
              <span className="text-sm font-medium text-slate-700">{noticePeriod}</span>
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
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
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
      <CardContent>
        <div className="space-y-2">
          {risks.slice(0, 3).map((risk, i) => (
            <div key={risk.id || `${risk.category}-${i}`} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg">
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
    <div className="space-y-4">
      <ExecutiveSummary summary={props.summary} keyTerms={props.keyTerms} />
      
      <div className="grid md:grid-cols-2 gap-4">
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

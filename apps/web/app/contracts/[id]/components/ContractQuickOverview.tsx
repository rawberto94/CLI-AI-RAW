'use client'

import React, { memo, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/design-tokens'
import { 
  formatPaymentType, 
  formatPeriodicity 
} from '@/lib/types/contract-metadata-schema'
import {
  DollarSign,
  Users,
  Calendar,
  Shield,
  Building,
  ArrowRight,
  Bell,
  AlertCircle,
  FileSignature,
  CheckCircle2,
  Clock,
} from 'lucide-react'

interface Party {
  legalName: string
  role?: string
  legalForm?: string
}

interface QuickOverviewProps {
  tcvAmount: number | null
  currency: string
  paymentType: string
  periodicity: string
  parties: Party[]
  startDate: string
  endDate: string
  noticePeriod?: string
  riskLevel: 'low' | 'medium' | 'high'
  complianceStatus: 'ok' | 'review'
  contractStatus: string
  signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  signatureRequiredFlag?: boolean
}

const overviewTileClassName = 'flex h-full min-h-[184px] flex-col rounded-[24px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.16)]'
const overviewTileHeaderClassName = 'mb-4 flex items-center gap-2.5'
const overviewTileLabelClassName = 'text-[10px] sm:text-xs font-semibold uppercase tracking-[0.22em] text-slate-500'

// Memoized sub-components for better performance
const ValueSection = memo(function ValueSection({
  tcvAmount,
  currency,
  paymentType,
  periodicity,
}: Pick<QuickOverviewProps, 'tcvAmount' | 'currency' | 'paymentType' | 'periodicity'>) {
  return (
    <div className={cn(overviewTileClassName, 'bg-[linear-gradient(135deg,rgba(245,243,255,0.95),rgba(255,255,255,1))]')}>
      <div className={overviewTileHeaderClassName}>
        <div className="rounded-2xl bg-violet-100 p-2 shadow-sm">
          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className={overviewTileLabelClassName}>Value</span>
      </div>
      <p className="mb-3 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">
        {tcvAmount != null && tcvAmount > 0 
          ? formatCurrency(tcvAmount, currency || 'USD')
          : <span className="text-slate-400 text-base sm:text-lg">Not specified</span>}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {paymentType && paymentType !== 'none' && (
          <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px] sm:text-xs font-medium hover:bg-violet-100">
            {formatPaymentType(paymentType as any)}
          </Badge>
        )}
        {periodicity && periodicity !== 'none' && (
          <Badge variant="outline" className="text-[10px] sm:text-xs text-slate-600 border-slate-200">
            {formatPeriodicity(periodicity as any)}
          </Badge>
        )}
      </div>
    </div>
  )
})

const PartiesSection = memo(function PartiesSection({
  parties,
}: { parties: Party[] }) {
  const displayParties = useMemo(() => parties.slice(0, 2), [parties])
  
  return (
    <div className={overviewTileClassName}>
      <div className={overviewTileHeaderClassName}>
        <div className="rounded-2xl bg-violet-100 p-2 shadow-sm">
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className={overviewTileLabelClassName}>Parties</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {displayParties.length > 0 ? (
          displayParties.map((party, idx) => {
            const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '')
            return (
              <div key={(party as any).id || party.legalName || `party-${idx}`} className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/80 px-3 py-2.5">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl',
                  isClient ? "bg-violet-100" : "bg-violet-100"
                )}>
                  {isClient ? (
                    <Building className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-violet-600" />
                  ) : (
                    <Users className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-violet-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-slate-800 truncate">{party.legalName}</p>
                  {party.role && (
                    <p className={cn(
                      "text-[10px] sm:text-xs",
                      isClient ? "text-violet-600" : "text-violet-600"
                    )}>
                      {party.role}
                    </p>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-1 items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-xs italic text-slate-400 sm:text-sm">No parties identified</div>
        )}
        {parties.length > 2 && (
          <button className="mt-auto text-left text-[10px] font-medium text-violet-600 hover:text-violet-700 sm:text-xs">
            +{parties.length - 2} more
          </button>
        )}
      </div>
    </div>
  )
})

const DurationSection = memo(function DurationSection({
  startDate,
  endDate,
  noticePeriod,
}: Pick<QuickOverviewProps, 'startDate' | 'endDate' | 'noticePeriod'>) {
  const { daysRemaining, isActive, isExpired, needsDateReview } = useMemo(() => {
    const days = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    return {
      daysRemaining: days,
      isActive: Boolean(startDate && new Date(startDate) <= new Date() && endDate && new Date(endDate) >= new Date()),
      isExpired: endDate ? new Date(endDate) < new Date() : false,
      needsDateReview: !endDate,
    }
  }, [startDate, endDate])

  return (
    <div className={overviewTileClassName}>
      <div className={overviewTileHeaderClassName}>
        <div className="rounded-2xl bg-violet-100 p-2 shadow-sm">
          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className={overviewTileLabelClassName}>Duration</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {/* Date Range */}
        <div className="flex min-h-[60px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs sm:text-sm">
          <span className="font-medium text-slate-600">{startDate ? formatDate(startDate) : '—'}</span>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
          <span className={cn(
            'font-semibold',
            isExpired ? "text-red-600" : 
            needsDateReview ? "text-slate-500" :
            daysRemaining !== null && daysRemaining <= 90 ? "text-amber-600" : 
            "text-slate-700"
          )}>
            {endDate ? formatDate(endDate) : 'Needs review'}
          </span>
        </div>
        
        {/* Status Badge */}
        <div className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5">
          {isExpired ? (
            <Badge className="bg-red-100 text-red-700 border-0 text-[10px] sm:text-xs">
              <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
              Expired
            </Badge>
          ) : needsDateReview ? (
            <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px] sm:text-xs">
              <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
              Date review
            </Badge>
          ) : isActive ? (
            <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px] sm:text-xs">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-violet-500 rounded-full mr-1 animate-pulse" />
              Active
            </Badge>
          ) : (
            <Badge className="bg-slate-100 text-slate-600 border-0 text-[10px] sm:text-xs">
              Pending
            </Badge>
          )}
          {daysRemaining !== null && daysRemaining > 0 && !needsDateReview && (
            <span className={cn(
              "text-[10px] sm:text-xs font-medium",
              daysRemaining <= 30 ? "text-red-600" :
              daysRemaining <= 90 ? "text-amber-600" : "text-slate-500"
            )}>
              {daysRemaining}d left
            </span>
          )}
        </div>
        
        {/* Notice Period */}
        {noticePeriod && !isExpired && (
          <div className="mt-auto flex min-h-[44px] items-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-[10px] text-slate-500 sm:text-xs">
            <Bell className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {noticePeriod} notice
          </div>
        )}
      </div>
    </div>
  )
})

const AssessmentSection = memo(function AssessmentSection({
  riskLevel,
  complianceStatus,
  contractStatus: _contractStatus,
  signatureStatus,
  signatureRequiredFlag,
}: Pick<QuickOverviewProps, 'riskLevel' | 'complianceStatus' | 'contractStatus' | 'signatureStatus' | 'signatureRequiredFlag'>) {
  return (
    <div className={overviewTileClassName}>
      <div className={overviewTileHeaderClassName}>
        <div className="rounded-2xl bg-amber-100 p-2 shadow-sm">
          <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
        </div>
        <span className={overviewTileLabelClassName}>Health</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5">
        {/* Signature Status */}
        <div className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={cn(
              "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full",
              signatureStatus === 'signed' ? 'bg-violet-500' : 
              signatureStatus === 'partially_signed' ? 'bg-amber-500' : 
              signatureStatus === 'unsigned' ? 'bg-red-500' :
              'bg-slate-400'
            )} />
            <span className="text-xs sm:text-sm font-medium text-slate-700">Signature</span>
            {signatureRequiredFlag && (
              <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
            )}
          </div>
          <Badge className={cn(
            "text-[10px] sm:text-xs font-medium border-0 flex items-center gap-1",
            signatureStatus === 'signed' ? 'bg-violet-100 text-violet-700' : 
            signatureStatus === 'partially_signed' ? 'bg-amber-100 text-amber-700' : 
            signatureStatus === 'unsigned' ? 'bg-red-100 text-red-700' :
            'bg-slate-100 text-slate-600'
          )}>
            {signatureStatus === 'signed' && <CheckCircle2 className="h-2.5 w-2.5" />}
            {signatureStatus === 'partially_signed' && <Clock className="h-2.5 w-2.5" />}
            {signatureStatus === 'unsigned' && <FileSignature className="h-2.5 w-2.5" />}
            {signatureStatus === 'signed' ? 'Signed' : 
             signatureStatus === 'partially_signed' ? 'Partial' : 
             signatureStatus === 'unsigned' ? 'Unsigned' : 
             'Unknown'}
          </Badge>
        </div>

        {/* Risk Level */}
        <div className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={cn(
              "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full",
              riskLevel === 'low' ? 'bg-violet-500' : 
              riskLevel === 'medium' ? 'bg-amber-500' : 
              'bg-red-500'
            )} />
            <span className="text-xs sm:text-sm font-medium text-slate-700">Risk</span>
          </div>
          <Badge className={cn(
            "text-[10px] sm:text-xs font-medium border-0",
            riskLevel === 'low' ? 'bg-violet-100 text-violet-700' : 
            riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' : 
            'bg-red-100 text-red-700'
          )}>
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
          </Badge>
        </div>
        
        {/* Compliance */}
        <div className="flex min-h-[44px] items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className={cn(
              "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full",
              complianceStatus === 'ok' ? 'bg-violet-500' : 'bg-amber-500'
            )} />
            <span className="text-xs sm:text-sm font-medium text-slate-700">Compliance</span>
          </div>
          <Badge className={cn(
            "text-[10px] sm:text-xs font-medium border-0",
            complianceStatus === 'ok' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'
          )}>
            {complianceStatus === 'ok' ? 'OK' : 'Review'}
          </Badge>
        </div>
      </div>
    </div>
  )
})

export const ContractQuickOverview = memo(function ContractQuickOverview(props: QuickOverviewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <ValueSection 
          tcvAmount={props.tcvAmount}
          currency={props.currency}
          paymentType={props.paymentType}
          periodicity={props.periodicity}
        />
        <PartiesSection parties={props.parties} />
        <DurationSection 
          startDate={props.startDate}
          endDate={props.endDate}
          noticePeriod={props.noticePeriod}
        />
        <AssessmentSection 
          riskLevel={props.riskLevel}
          complianceStatus={props.complianceStatus}
          contractStatus={props.contractStatus}
          signatureStatus={props.signatureStatus}
          signatureRequiredFlag={props.signatureRequiredFlag}
        />
    </div>
  )
})

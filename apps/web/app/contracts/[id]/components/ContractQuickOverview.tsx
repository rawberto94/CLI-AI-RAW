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
  tcvAmount: number
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

// Memoized sub-components for better performance
const ValueSection = memo(function ValueSection({
  tcvAmount,
  currency,
  paymentType,
  periodicity,
}: Pick<QuickOverviewProps, 'tcvAmount' | 'currency' | 'paymentType' | 'periodicity'>) {
  return (
    <div className="p-4 sm:p-5 border-b sm:border-b lg:border-b-0 sm:border-r border-slate-100 bg-gradient-to-br from-violet-50/40 via-white to-white">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-1.5 sm:mb-2">
        {tcvAmount > 0 
          ? formatCurrency(tcvAmount, currency || 'USD')
          : <span className="text-slate-400 text-base sm:text-lg">Not specified</span>}
      </p>
      <div className="flex flex-wrap items-center gap-1">
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
    <div className="p-4 sm:p-5 border-b lg:border-b-0 sm:border-r border-slate-100">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Parties</span>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        {displayParties.length > 0 ? (
          displayParties.map((party, idx) => {
            const isClient = ['Client', 'Buyer', 'Customer', 'Purchaser'].includes(party.role || '')
            return (
              <div key={(party as any).id || party.legalName || `party-${idx}`} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0",
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
          <p className="text-xs sm:text-sm text-slate-400 italic">No parties identified</p>
        )}
        {parties.length > 2 && (
          <button className="text-[10px] sm:text-xs text-violet-600 hover:text-violet-700 font-medium">
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
  const { daysRemaining, isActive, isExpired, isEvergreen } = useMemo(() => {
    const days = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
    return {
      daysRemaining: days,
      isActive: startDate && new Date(startDate) <= new Date() && (!endDate || new Date(endDate) >= new Date()),
      isExpired: endDate ? new Date(endDate) < new Date() : false,
      isEvergreen: !endDate,
    }
  }, [startDate, endDate])

  return (
    <div className="p-4 sm:p-5 border-b sm:border-b-0 sm:border-r border-slate-100">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-600" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Duration</span>
      </div>
      <div className="space-y-1.5 sm:space-y-2">
        {/* Date Range */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
          <span className="text-slate-600">{startDate ? formatDate(startDate) : '—'}</span>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
          <span className={cn(
            "font-medium",
            isExpired ? "text-red-600" : 
            isEvergreen ? "text-violet-600" :
            daysRemaining !== null && daysRemaining <= 90 ? "text-amber-600" : 
            "text-slate-700"
          )}>
            {endDate ? formatDate(endDate) : 'Evergreen'}
          </span>
        </div>
        
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isExpired ? (
            <Badge className="bg-red-100 text-red-700 border-0 text-[10px] sm:text-xs">
              <AlertCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
              Expired
            </Badge>
          ) : isEvergreen ? (
            <Badge className="bg-violet-100 text-violet-700 border-0 text-[10px] sm:text-xs">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-violet-500 rounded-full mr-1" />
              Auto-renewing
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
          {daysRemaining !== null && daysRemaining > 0 && !isEvergreen && (
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
          <p className="text-[10px] sm:text-xs text-slate-500 flex items-center gap-1">
            <Bell className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            {noticePeriod} notice
          </p>
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
    <div className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2 sm:mb-3">
        <div className="p-1.5 rounded-lg bg-amber-100">
          <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
        </div>
        <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">Health</span>
      </div>
      <div className="space-y-2">
        {/* Signature Status */}
        <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-between">
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
    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0">
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
    </Card>
  )
})

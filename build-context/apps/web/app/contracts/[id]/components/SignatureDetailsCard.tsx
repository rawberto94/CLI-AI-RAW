'use client'

import React, { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FileSignature,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Building2,
  Send,
  History,
  HelpCircle,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Signatory {
  id?: string
  name: string
  title?: string
  email?: string
  organization?: string
  signedAt?: Date | string | null
  status: 'signed' | 'pending' | 'declined' | 'not_required'
}

interface SignatureDetailsCardProps {
  status: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  signatories: Signatory[]
  signatureDate?: Date | string | null
  signatureMethod?: 'wet_ink' | 'electronic' | 'digital' | 'unknown'
  signatureAnalysis?: string
  signatureRequired?: boolean
  onSendReminder?: (signatory: Signatory) => void
  onViewHistory?: () => void
  onRequestSignature?: () => void
  className?: string
}

const SignatoryRow = memo(function SignatoryRow({
  signatory,
  onSendReminder,
}: {
  signatory: Signatory
  onSendReminder?: (signatory: Signatory) => void
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-lg border transition-colors",
      signatory.status === 'signed' ? "bg-emerald-50/50 border-emerald-100" :
      signatory.status === 'pending' ? "bg-amber-50/50 border-amber-100" :
      signatory.status === 'declined' ? "bg-red-50/50 border-red-100" :
      "bg-slate-50/50 border-slate-100"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-full",
          signatory.status === 'signed' ? "bg-emerald-100" :
          signatory.status === 'pending' ? "bg-amber-100" :
          signatory.status === 'declined' ? "bg-red-100" :
          "bg-slate-100"
        )}>
          <User className={cn(
            "h-4 w-4",
            signatory.status === 'signed' ? "text-emerald-600" :
            signatory.status === 'pending' ? "text-amber-600" :
            signatory.status === 'declined' ? "text-red-600" :
            "text-slate-500"
          )} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900">{signatory.name}</span>
            {signatory.status === 'signed' && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </div>
          {signatory.title && (
            <p className="text-xs text-slate-500">{signatory.title}</p>
          )}
          {signatory.organization && (
            <div className="flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 text-slate-400" />
              <span className="text-[10px] text-slate-400">{signatory.organization}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {signatory.status === 'signed' && signatory.signedAt && (
          <div className="text-right">
            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0">
              Signed
            </Badge>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {new Date(signatory.signedAt).toLocaleDateString()}
            </p>
          </div>
        )}
        
        {signatory.status === 'pending' && (
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">
              Pending
            </Badge>
            {onSendReminder && signatory.email && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSendReminder(signatory)}
                      className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Send reminder to {signatory.email}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}
        
        {signatory.status === 'declined' && (
          <Badge className="text-[10px] bg-red-100 text-red-700 border-0">
            Declined
          </Badge>
        )}
        
        {signatory.status === 'not_required' && (
          <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0">
            Optional
          </Badge>
        )}
      </div>
    </div>
  )
})

export const SignatureDetailsCard = memo(function SignatureDetailsCard({
  status,
  signatories,
  signatureDate,
  signatureMethod,
  signatureAnalysis,
  signatureRequired = true,
  onSendReminder,
  onViewHistory,
  onRequestSignature,
  className,
}: SignatureDetailsCardProps) {
  
  const signedCount = signatories.filter(s => s.status === 'signed').length
  const pendingCount = signatories.filter(s => s.status === 'pending').length
  const totalRequired = signatories.filter(s => s.status !== 'not_required').length
  
  const statusConfig = {
    signed: {
      label: 'Fully Signed',
      description: 'All required signatures obtained',
      icon: CheckCircle2,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-700',
    },
    partially_signed: {
      label: 'Partially Signed',
      description: `${signedCount} of ${totalRequired} signatures obtained`,
      icon: Clock,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-700',
    },
    unsigned: {
      label: 'Unsigned',
      description: signatureRequired ? 'No signatures obtained yet' : 'Signature not required',
      icon: AlertCircle,
      iconColor: signatureRequired ? 'text-red-500' : 'text-slate-400',
      bgColor: signatureRequired ? 'bg-red-50' : 'bg-slate-50',
      borderColor: signatureRequired ? 'border-red-200' : 'border-slate-200',
      badgeClass: signatureRequired ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600',
    },
    unknown: {
      label: 'Unknown',
      description: 'Signature status could not be determined',
      icon: HelpCircle,
      iconColor: 'text-slate-400',
      bgColor: 'bg-slate-50',
      borderColor: 'border-slate-200',
      badgeClass: 'bg-slate-100 text-slate-600',
    },
  }[status]
  
  const StatusIcon = statusConfig.icon
  
  const methodLabels = {
    wet_ink: 'Wet Ink / Physical',
    electronic: 'Electronic Signature',
    digital: 'Digital Certificate',
    unknown: 'Unknown Method',
  }

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-sm bg-white",
      className
    )}>
      {/* Header */}
      <div className={cn(
        "p-4 sm:p-5 border-b",
        statusConfig.bgColor,
        statusConfig.borderColor
      )}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-lg bg-white shadow-sm",
              statusConfig.borderColor,
              "border"
            )}>
              <StatusIcon className={cn("h-5 w-5", statusConfig.iconColor)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  Signature Status
                </h3>
                <Badge className={cn("text-[10px] sm:text-xs border-0", statusConfig.badgeClass)}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {statusConfig.description}
              </p>
            </div>
          </div>
          
          {/* Progress indicator */}
          {totalRequired > 0 && (
            <div className="text-right">
              <span className="text-lg sm:text-xl font-bold text-slate-900">
                {signedCount}/{totalRequired}
              </span>
              <p className="text-[10px] sm:text-xs text-slate-500">signatures</p>
            </div>
          )}
        </div>
        
        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 pt-3 border-t border-white/50">
          {signatureDate && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="h-3.5 w-3.5" />
              <span>Signed {new Date(signatureDate).toLocaleDateString()}</span>
            </div>
          )}
          {signatureMethod && signatureMethod !== 'unknown' && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <FileSignature className="h-3.5 w-3.5" />
              <span>{methodLabels[signatureMethod]}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 sm:p-5">
        {/* AI Analysis */}
        {signatureAnalysis && (
          <div className="mb-4 pb-4 border-b border-slate-100">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">
              AI Analysis
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">
              {signatureAnalysis}
            </p>
          </div>
        )}
        
        {/* Signatories List */}
        {signatories.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Signatories ({signatories.length})
              </span>
              {pendingCount > 0 && (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200">
                  {pendingCount} pending
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {signatories.map((signatory, idx) => (
                <SignatoryRow
                  key={signatory.id || idx}
                  signatory={signatory}
                  onSendReminder={onSendReminder}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Empty state for signatories */}
        {signatories.length === 0 && status !== 'unknown' && (
          <div className="text-center py-4">
            <p className="text-sm text-slate-500">No signatories identified</p>
            <p className="text-xs text-slate-400 mt-1">
              Run AI extraction to detect signatories
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          {status !== 'signed' && pendingCount > 0 && onSendReminder && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                const pending = signatories.find(s => s.status === 'pending')
                if (pending) onSendReminder(pending)
              }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send All Reminders
            </Button>
          )}
          
          {status === 'unsigned' && signatureRequired && onRequestSignature && (
            <Button
              size="sm"
              variant="default"
              onClick={onRequestSignature}
              className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-xs"
            >
              <FileSignature className="h-3.5 w-3.5 mr-1.5" />
              Request Signatures
            </Button>
          )}
          
          {onViewHistory && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onViewHistory}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              View History
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
})

export default SignatureDetailsCard

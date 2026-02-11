'use client'

import React, { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  X,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Share2,
  Eye,
  Sparkles,
  Clock,
  AlertTriangle,
  FileSignature,
  Shield,
  Scale,
  Edit3,
  Brain,
  RefreshCw,
  History,
  GitBranch,
  Tag,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ContractParty {
  client?: string
  supplier?: string
  signatories?: string[]
}

interface Contract {
  id: string
  title?: string
  type?: string
  status: string
  documentRole?: string
  parties?: ContractParty
  value?: number
  effectiveDate?: string
  expirationDate?: string
  createdAt?: string
  updatedAt?: string
  signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  riskScore?: number
  complianceStatus?: string
  category?: {
    name: string
    color?: string
    icon?: string
  }
  documentClassification?: string
  extractionStatus?: string
  summary?: string
  tags?: string[]
  aiMetadata?: {
    keyTerms?: Array<{ term: string; value: string }>
    risks?: string[]
    obligations?: Array<{ description: string }>
  }
}

interface EnhancedContractPreviewPanelProps {
  contract: Contract | null
  isOpen: boolean
  onClose: () => void
  onView?: () => void
  onDownload?: () => void
  onShare?: () => void
  onAIAnalysis?: () => void
  onLegalReview?: () => void
  onRedline?: () => void
  onRenewal?: () => void
  onAmendment?: () => void
  formatCurrency?: (value?: number) => string
  formatDate?: (date?: string) => string
  className?: string
}

const InfoRow = memo(function InfoRow({
  icon: Icon,
  label,
  value,
  valueClassName,
  badge,
  badgeVariant = 'secondary',
}: {
  icon: React.ElementType
  label: string
  value: string | React.ReactNode
  valueClassName?: string
  badge?: string
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive'
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-medium text-slate-900", valueClassName)}>
          {value}
        </span>
        {badge && (
          <Badge variant={badgeVariant} className="text-[10px]">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  )
})

export const EnhancedContractPreviewPanel = memo(function EnhancedContractPreviewPanel({
  contract,
  isOpen,
  onClose,
  onView,
  onDownload,
  onShare,
  onAIAnalysis,
  onLegalReview,
  onRedline,
  onRenewal,
  onAmendment,
  formatCurrency = (v) => v ? new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', maximumFractionDigits: 0 }).format(v) : '—',
  formatDate = (d) => d ? new Date(d).toLocaleDateString() : '—',
  className,
}: EnhancedContractPreviewPanelProps) {
  
  // Calculate derived values
  const derivedValues = useMemo(() => {
    if (!contract) return null
    
    const now = new Date()
    const expDate = contract.expirationDate ? new Date(contract.expirationDate) : null
    const effectiveDate = contract.effectiveDate ? new Date(contract.effectiveDate) : null
    
    let daysRemaining: number | null = null
    let isExpired = false
    let isExpiringSoon = false
    
    if (expDate) {
      daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      isExpired = daysRemaining < 0
      isExpiringSoon = daysRemaining > 0 && daysRemaining <= 30
    }
    
    let durationMonths: number | null = null
    if (effectiveDate && expDate) {
      durationMonths = Math.round((expDate.getTime() - effectiveDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    }
    
    // Risk level
    const riskLevel = contract.riskScore !== undefined
      ? contract.riskScore >= 70 ? 'high' : contract.riskScore >= 40 ? 'medium' : 'low'
      : 'unknown'
    
    return {
      daysRemaining,
      isExpired,
      isExpiringSoon,
      durationMonths,
      riskLevel,
    }
  }, [contract])

  if (!contract) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="open"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 z-50 overflow-hidden flex flex-col",
            className
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 truncate">
                    {contract.title || 'Untitled Contract'}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{contract.type || 'Contract'}</span>
                    {contract.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {contract.category.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={onClose}
                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Contract Status */}
              <Badge
                className={cn(
                  "text-xs",
                  contract.status === 'active' && "bg-emerald-100 text-emerald-700",
                  contract.status === 'draft' && "bg-slate-100 text-slate-600",
                  contract.status === 'expired' && "bg-red-100 text-red-700",
                  contract.status === 'pending_review' && "bg-amber-100 text-amber-700"
                )}
              >
                {contract.status?.replace('_', ' ').charAt(0).toUpperCase() + contract.status?.slice(1).replace('_', ' ')}
              </Badge>
              
              {/* Signature Status */}
              {contract.signatureStatus && (
                <Badge
                  className={cn(
                    "text-xs",
                    contract.signatureStatus === 'signed' && "bg-emerald-100 text-emerald-700",
                    contract.signatureStatus === 'partially_signed' && "bg-amber-100 text-amber-700",
                    contract.signatureStatus === 'unsigned' && "bg-red-100 text-red-700"
                  )}
                >
                  <FileSignature className="h-3 w-3 mr-1" />
                  {contract.signatureStatus === 'signed' ? 'Signed' :
                   contract.signatureStatus === 'partially_signed' ? 'Partial' :
                   contract.signatureStatus === 'unsigned' ? 'Unsigned' : 'Unknown'}
                </Badge>
              )}
              
              {/* Risk Badge */}
              {derivedValues?.riskLevel && derivedValues.riskLevel !== 'unknown' && (
                <Badge
                  className={cn(
                    "text-xs",
                    derivedValues.riskLevel === 'high' && "bg-red-100 text-red-700",
                    derivedValues.riskLevel === 'medium' && "bg-amber-100 text-amber-700",
                    derivedValues.riskLevel === 'low' && "bg-emerald-100 text-emerald-700"
                  )}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  {derivedValues.riskLevel.charAt(0).toUpperCase() + derivedValues.riskLevel.slice(1)} Risk
                </Badge>
              )}
              
              {/* Expiration Warning */}
              {derivedValues?.isExpired && (
                <Badge className="text-xs bg-red-100 text-red-700">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Expired
                </Badge>
              )}
              {derivedValues?.isExpiringSoon && !derivedValues.isExpired && (
                <Badge className="text-xs bg-amber-100 text-amber-700">
                  <Clock className="h-3 w-3 mr-1" />
                  Expiring Soon
                </Badge>
              )}
            </div>
          </div>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Quick Stats */}
            <div className="p-4 grid grid-cols-2 gap-3 border-b border-slate-100 bg-slate-50/50">
              <div className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Value</span>
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  contract.value ? "text-slate-900" : "text-slate-400"
                )}>
                  {formatCurrency(contract.value)}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">
                    {derivedValues?.isExpired ? 'Expired' : 'Remaining'}
                  </span>
                </div>
                <p className={cn(
                  "text-lg font-bold",
                  derivedValues?.isExpired ? "text-red-600" :
                  derivedValues?.isExpiringSoon ? "text-amber-600" : "text-slate-900"
                )}>
                  {derivedValues?.daysRemaining !== null
                    ? derivedValues.isExpired
                      ? `${Math.abs(derivedValues.daysRemaining)} days ago`
                      : `${derivedValues.daysRemaining} days`
                    : '—'
                  }
                </p>
              </div>
            </div>
            
            {/* Summary */}
            {contract.summary && (
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                    AI Summary
                  </span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {contract.summary}
                </p>
              </div>
            )}
            
            {/* Contract Details */}
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">
                Contract Details
              </h3>
              <div className="space-y-1 divide-y divide-slate-100">
                {contract.parties?.client && (
                  <InfoRow
                    icon={Building2}
                    label="Client"
                    value={contract.parties.client}
                  />
                )}
                {contract.parties?.supplier && (
                  <InfoRow
                    icon={Building2}
                    label="Supplier"
                    value={contract.parties.supplier}
                  />
                )}
                <InfoRow
                  icon={Calendar}
                  label="Effective Date"
                  value={formatDate(contract.effectiveDate)}
                />
                <InfoRow
                  icon={Calendar}
                  label="Expiration Date"
                  value={formatDate(contract.expirationDate)}
                  valueClassName={derivedValues?.isExpired ? 'text-red-600' : derivedValues?.isExpiringSoon ? 'text-amber-600' : undefined}
                />
                {derivedValues?.durationMonths && (
                  <InfoRow
                    icon={Clock}
                    label="Duration"
                    value={`${derivedValues.durationMonths} months`}
                  />
                )}
                <InfoRow
                  icon={History}
                  label="Created"
                  value={formatDate(contract.createdAt)}
                />
                <InfoRow
                  icon={RefreshCw}
                  label="Last Updated"
                  value={formatDate(contract.updatedAt)}
                />
              </div>
            </div>
            
            {/* Key Terms */}
            {contract.aiMetadata?.keyTerms && contract.aiMetadata.keyTerms.length > 0 && (
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3">
                  Key Terms
                </h3>
                <div className="flex flex-wrap gap-2">
                  {contract.aiMetadata.keyTerms.slice(0, 8).map((term, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-100"
                    >
                      <span className="text-[10px] font-medium text-slate-500">{term.term}:</span>
                      <span className="text-[10px] text-slate-700">{term.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Risks */}
            {contract.aiMetadata?.risks && contract.aiMetadata.risks.length > 0 && (
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Identified Risks
                </h3>
                <div className="space-y-2">
                  {contract.aiMetadata.risks.slice(0, 3).map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded bg-amber-50/50 border border-amber-100">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-800">{risk}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tags */}
            {contract.tags && contract.tags.length > 0 && (
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-slate-400" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {contract.tags.map((tag, idx) => (
                    <Badge key={idx} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Actions Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80">
            {/* Primary Actions */}
            <div className="flex items-center gap-2 mb-3">
              {onView && (
                <Button
                  size="sm"
                  onClick={onView}
                  className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  View Details
                </Button>
              )}
              {onAIAnalysis && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAIAnalysis}
                  className="flex-1"
                >
                  <Brain className="h-4 w-4 mr-1.5 text-violet-500" />
                  AI Analysis
                </Button>
              )}
            </div>
            
            {/* Secondary Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  {onDownload && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onDownload} className="h-8 w-8 p-0">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download</TooltipContent>
                    </Tooltip>
                  )}
                  {onShare && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onShare} className="h-8 w-8 p-0">
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share</TooltipContent>
                    </Tooltip>
                  )}
                  {onLegalReview && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onLegalReview} className="h-8 w-8 p-0">
                          <Scale className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Legal Review</TooltipContent>
                    </Tooltip>
                  )}
                  {onRedline && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onRedline} className="h-8 w-8 p-0">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Redline Editor</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
              
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  {onRenewal && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onRenewal} className="h-8 px-2 text-xs">
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                          Renewal
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Start Renewal</TooltipContent>
                    </Tooltip>
                  )}
                  {onAmendment && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={onAmendment} className="h-8 px-2 text-xs">
                          <GitBranch className="h-3.5 w-3.5 mr-1" />
                          Amend
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Create Amendment</TooltipContent>
                    </Tooltip>
                  )}
                </TooltipProvider>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

export default EnhancedContractPreviewPanel

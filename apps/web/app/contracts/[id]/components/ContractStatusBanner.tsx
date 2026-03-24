'use client'

import React, { memo, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/design-tokens'
import { AlertCircle, Clock, AlertTriangle, PenLine, FileWarning, FileX as _FileX, Eye, ChevronDown, ChevronUp } from 'lucide-react'
import type { SignatureStatus, DocumentClassification } from '@/lib/types/contract-metadata-schema'

type BannerType = 'expired' | 'expiring' | 'high-risk' | 'review-needed' | 'unsigned' | 'not-a-contract' | 'pending-review' | null

interface StatusBannerProps {
  endDate: string | null
  riskLevel: 'low' | 'medium' | 'high'
  complianceOk: boolean
  contractStatus?: string
  signatureStatus?: SignatureStatus
  documentClassification?: DocumentClassification
  documentClassificationWarning?: string
  onAction?: () => void
  onInitiateRenewal?: () => void
  onSetReminder?: () => void
  onRequestSignature?: () => void
  onStartReview?: () => void
  onStartRedline?: () => void
}

/**
 * Get human-readable label for document classification
 */
function getDocumentClassificationLabel(classification: DocumentClassification): string {
  const labels: Record<DocumentClassification, string> = {
    contract: 'Contract',
    purchase_order: 'Purchase Order',
    invoice: 'Invoice',
    quote: 'Quote/Estimate',
    proposal: 'Proposal',
    work_order: 'Work Order',
    letter_of_intent: 'Letter of Intent',
    memorandum: 'Memorandum',
    amendment: 'Amendment',
    addendum: 'Addendum',
    unknown: 'Unknown Document Type',
  }
  return labels[classification] || classification
}

/**
 * Check if document classification is a non-contract type
 */
function isNonContractDocument(classification?: DocumentClassification): boolean {
  if (!classification) return false
  return ['purchase_order', 'invoice', 'quote', 'proposal', 'memorandum', 'unknown'].includes(classification)
}

export const ContractStatusBanner = memo(function ContractStatusBanner({
  endDate,
  riskLevel,
  complianceOk,
  contractStatus,
  signatureStatus,
  documentClassification,
  documentClassificationWarning,
  onAction,
  onInitiateRenewal,
  onSetReminder,
  onRequestSignature,
  onStartReview,
  onStartRedline,
}: StatusBannerProps) {
  // Generate all applicable banners
  const banners = useMemo(() => {
    const result: Array<{
      type: BannerType
      icon: React.ElementType
      bgClass: string
      textClass: string
      title: string
      subtitle: string
      buttonText?: string
      secondaryButtonText?: string
      buttonClass?: string
      priority: number
    }> = []
    
    // Document classification warning (highest priority)
    if (isNonContractDocument(documentClassification)) {
      result.push({
        type: 'not-a-contract',
        icon: FileWarning,
        bgClass: 'bg-orange-50 border-orange-200',
        textClass: 'text-orange-700',
        title: `This is a ${getDocumentClassificationLabel(documentClassification!)}`,
        subtitle: documentClassificationWarning || 'This document may not be a binding contract. Review carefully before treating it as a legal agreement.',
        priority: 100,
      })
    }
    
    // Pending review / in-review banner
    const isPendingReview = contractStatus && ['PENDING', 'pending', 'pending_review', 'IN_REVIEW'].includes(contractStatus)
    if (isPendingReview) {
      result.push({
        type: 'pending-review',
        icon: Eye,
        bgClass: 'bg-blue-50 border-blue-200',
        textClass: 'text-blue-700',
        title: 'Pending Review',
        subtitle: 'This document was uploaded for review. Start a legal review or redline session to proceed.',
        buttonText: 'Start Review',
        buttonClass: 'border-blue-300 text-blue-700 hover:bg-blue-100',
        priority: 95,
      })
    }
    
    // Signature status warning
    if (signatureStatus === 'unsigned') {
      result.push({
        type: 'unsigned',
        icon: PenLine,
        bgClass: 'bg-violet-50 border-violet-200',
        textClass: 'text-violet-700',
        title: 'Contract Not Signed',
        subtitle: 'This contract has not been executed. It may not be legally binding.',
        buttonText: 'Request Signature',
        buttonClass: 'border-violet-300 text-violet-700 hover:bg-violet-100',
        priority: 90,
      })
    } else if (signatureStatus === 'partially_signed') {
      result.push({
        type: 'unsigned',
        icon: PenLine,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        title: 'Partially Signed',
        subtitle: 'Some parties have not yet signed this contract.',
        buttonText: 'Request Signature',
        buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-100',
        priority: 85,
      })
    }
    
    // Expiration banners
    const daysRemaining = endDate 
      ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) 
      : null
    
    const isExpired = daysRemaining !== null && daysRemaining < 0
    const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 90
    
    if (isExpired) {
      result.push({
        type: 'expired',
        icon: AlertCircle,
        bgClass: 'bg-red-50 border-red-200',
        textClass: 'text-red-700',
        title: 'Contract Expired',
        subtitle: `Ended ${formatDate(endDate!)} (${Math.abs(daysRemaining!)} days ago)`,
        buttonText: 'Initiate Renewal',
        buttonClass: 'border-red-300 text-red-700 hover:bg-red-100',
        priority: 80,
      })
    } else if (isExpiringSoon) {
      result.push({
        type: 'expiring',
        icon: Clock,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        title: 'Expiring Soon',
        subtitle: `${daysRemaining} days until ${formatDate(endDate!)}`,
        buttonText: 'Start Renewal',
        secondaryButtonText: 'Set Reminder',
        buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-100',
        priority: 70,
      })
    }
    
    // Risk and compliance banners
    const isHighRisk = riskLevel === 'high'
    const needsReview = !complianceOk
    
    if (isHighRisk || needsReview) {
      result.push({
        type: isHighRisk ? 'high-risk' : 'review-needed',
        icon: AlertTriangle,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        title: isHighRisk ? 'High Risk Contract' : 'Review Needed',
        subtitle: needsReview ? 'Compliance review required' : 'Risk assessment recommended',
        buttonText: 'View Details',
        buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-100',
        priority: 60,
      })
    }
    
    // Sort by priority (highest first)
    return result.sort((a, b) => b.priority - a.priority)
  }, [endDate, riskLevel, complianceOk, signatureStatus, documentClassification, documentClassificationWarning])
  
  if (banners.length === 0) return null
  
  const MAX_VISIBLE = 2
  const [expanded, setExpanded] = useState(false)
  const visibleBanners = expanded ? banners : banners.slice(0, MAX_VISIBLE)
  const hiddenCount = banners.length - MAX_VISIBLE

  // Render all banners
  return (
    <div className="space-y-2 mb-4">
      {visibleBanners.map((banner, index) => {
        const Icon = banner.icon
        
        const handleAction = () => {
          if (banner.type === 'pending-review' && onStartReview) {
            onStartReview()
          } else if (banner.type === 'unsigned' && onRequestSignature) {
            onRequestSignature()
          } else if ((banner.type === 'expired' || banner.type === 'expiring') && onInitiateRenewal) {
            onInitiateRenewal()
          } else if (onAction) {
            onAction()
          }
        }

        const handleSecondaryAction = () => {
          if (banner.type === 'expiring' && onSetReminder) {
            onSetReminder()
          }
        }
        
        const hasAction = banner.buttonText && (
          onAction || 
          (banner.type === 'pending-review' && onStartReview) ||
          (banner.type === 'unsigned' && onRequestSignature) ||
          (banner.type === 'expired' && onInitiateRenewal) || 
          (banner.type === 'expiring' && (onInitiateRenewal || onSetReminder))
        )

        const hasSecondaryAction = banner.secondaryButtonText && banner.type === 'expiring' && onSetReminder
        
        return (
          <div
            key={banner.type || index}
            className={cn(
              "flex items-center gap-3 p-3 border rounded-xl",
              banner.bgClass,
              banner.textClass
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{banner.title}</span>
              <span className="mx-2 hidden sm:inline">·</span>
              <span className="block sm:inline text-sm">{banner.subtitle}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasSecondaryAction && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleSecondaryAction}
                  className={cn("hidden sm:inline-flex text-xs", banner.buttonClass)}
                >
                  {banner.secondaryButtonText}
                </Button>
              )}
              {hasAction && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleAction}
                  className={cn(banner.buttonClass)}
                >
                  <span className="hidden sm:inline">{banner.buttonText}</span>
                  <span className="sm:hidden">Action</span>
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {hiddenCount > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-1"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {hiddenCount} more {hiddenCount === 1 ? 'alert' : 'alerts'}
        </button>
      )}
      {expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors px-1"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Show fewer
        </button>
      )}
    </div>
  )
})

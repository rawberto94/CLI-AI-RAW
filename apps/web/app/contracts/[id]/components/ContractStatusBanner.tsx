'use client'

import React, { memo, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/design-tokens'
import { AlertCircle, Clock, AlertTriangle } from 'lucide-react'

type BannerType = 'expired' | 'expiring' | 'high-risk' | 'review-needed' | null

interface StatusBannerProps {
  endDate: string | null
  riskLevel: 'low' | 'medium' | 'high'
  complianceOk: boolean
  onAction?: () => void
  onInitiateRenewal?: () => void
  onSetReminder?: () => void
}

export const ContractStatusBanner = memo(function ContractStatusBanner({
  endDate,
  riskLevel,
  complianceOk,
  onAction,
  onInitiateRenewal,
  onSetReminder,
}: StatusBannerProps) {
  const bannerInfo = useMemo(() => {
    if (!endDate && riskLevel !== 'high' && complianceOk) return null
    
    const daysRemaining = endDate 
      ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) 
      : null
    
    const isExpired = daysRemaining !== null && daysRemaining < 0
    const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 90
    const isHighRisk = riskLevel === 'high'
    const needsReview = !complianceOk
    
    if (isExpired) {
      return {
        type: 'expired' as BannerType,
        icon: AlertCircle,
        bgClass: 'bg-red-50 border-red-200',
        textClass: 'text-red-700',
        title: 'Contract Expired',
        subtitle: `Ended ${formatDate(endDate)} (${Math.abs(daysRemaining!)} days ago)`,
        buttonText: 'Initiate Renewal',
        buttonClass: 'border-red-300 text-red-700 hover:bg-red-100',
      }
    }
    
    if (isExpiringSoon) {
      return {
        type: 'expiring' as BannerType,
        icon: Clock,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        title: 'Expiring Soon',
        subtitle: `${daysRemaining} days until ${formatDate(endDate)}`,
        buttonText: 'Set Reminder',
        buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-100',
      }
    }
    
    if (isHighRisk || needsReview) {
      return {
        type: isHighRisk ? 'high-risk' as BannerType : 'review-needed' as BannerType,
        icon: AlertTriangle,
        bgClass: 'bg-amber-50 border-amber-200',
        textClass: 'text-amber-700',
        title: isHighRisk ? 'High Risk Contract' : 'Review Needed',
        subtitle: needsReview ? 'Compliance review required' : 'Risk assessment recommended',
        buttonText: 'View Details',
        buttonClass: 'border-amber-300 text-amber-700 hover:bg-amber-100',
      }
    }
    
    return null
  }, [endDate, riskLevel, complianceOk])
  
  if (!bannerInfo) return null
  
  const Icon = bannerInfo.icon
  
  // Determine which action to call based on banner type
  const handleAction = () => {
    if (bannerInfo.type === 'expired' && onInitiateRenewal) {
      onInitiateRenewal()
    } else if (bannerInfo.type === 'expiring' && onSetReminder) {
      onSetReminder()
    } else if (onAction) {
      onAction()
    }
  }
  
  const hasAction = onAction || 
    (bannerInfo.type === 'expired' && onInitiateRenewal) || 
    (bannerInfo.type === 'expiring' && onSetReminder)
  
  return (
    <div className={cn(
      "mb-4 flex items-center gap-3 p-3 border rounded-xl",
      bannerInfo.bgClass,
      bannerInfo.textClass
    )}>
      <Icon className="h-5 w-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">{bannerInfo.title}</span>
        <span className="mx-2 hidden sm:inline">·</span>
        <span className="block sm:inline text-sm">{bannerInfo.subtitle}</span>
      </div>
      {hasAction && (
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleAction}
          className={cn("shrink-0", bannerInfo.buttonClass)}
        >
          <span className="hidden sm:inline">{bannerInfo.buttonText}</span>
          <span className="sm:hidden">Action</span>
        </Button>
      )}
    </div>
  )
})

'use client'

import React, { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  FileSignature,
  DollarSign,
  Calendar,
  Shield,
  CheckCircle2,
  ChevronRight,
  X,
  TrendingUp,
  Sparkles,
} from 'lucide-react'

interface SmartAlert {
  id: string
  type: 'critical' | 'warning' | 'info' | 'success' | 'opportunity'
  category: 'expiration' | 'signature' | 'value' | 'compliance' | 'risk' | 'renewal' | 'obligation' | 'general'
  title: string
  message: string
  actionLabel?: string
  onAction?: () => void
  dismissible?: boolean
  priority: number // 1-100, higher = more important
  metadata?: {
    daysRemaining?: number
    amount?: number
    deadline?: Date
  }
}

interface ContractSmartAlertsProps {
  // Contract data for automatic alert generation
  expirationDate?: Date | string | null
  signatureStatus?: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  contractValue?: number | null
  riskLevel?: 'low' | 'medium' | 'high'
  complianceStatus?: 'ok' | 'review' | 'non_compliant'
  hasRenewalClause?: boolean
  autoRenewal?: boolean
  pendingObligations?: number
  overdueObligations?: number
  hasParties?: boolean
  extractionComplete?: boolean
  
  // Custom alerts
  customAlerts?: SmartAlert[]
  
  // Callbacks
  onDismissAlert?: (alertId: string) => void
  onRequestSignature?: () => void
  onSetReminder?: () => void
  onReviewRisks?: () => void
  onRunExtraction?: () => void
  onViewObligations?: () => void
  onInitiateRenewal?: () => void
  
  // Display options
  maxAlerts?: number
  showDismissed?: boolean
  className?: string
}

const AlertIcon = ({ type, category }: { type: SmartAlert['type']; category: SmartAlert['category'] }) => {
  const iconClass = "h-4 w-4"
  
  // Use category-specific icons
  switch (category) {
    case 'expiration': return <Calendar className={iconClass} />
    case 'signature': return <FileSignature className={iconClass} />
    case 'value': return <DollarSign className={iconClass} />
    case 'compliance': return <Shield className={iconClass} />
    case 'risk': return <AlertTriangle className={iconClass} />
    case 'renewal': return <Clock className={iconClass} />
    case 'obligation': return <CheckCircle2 className={iconClass} />
    default:
      // Fall back to type-based icons
      switch (type) {
        case 'critical': return <AlertCircle className={iconClass} />
        case 'warning': return <AlertTriangle className={iconClass} />
        case 'success': return <CheckCircle2 className={iconClass} />
        case 'opportunity': return <TrendingUp className={iconClass} />
        default: return <Info className={iconClass} />
      }
  }
}

export const ContractSmartAlerts = memo(function ContractSmartAlerts({
  expirationDate,
  signatureStatus,
  contractValue,
  riskLevel,
  complianceStatus,
  hasRenewalClause,
  autoRenewal,
  pendingObligations,
  overdueObligations,
  hasParties,
  extractionComplete,
  customAlerts = [],
  onDismissAlert,
  onRequestSignature,
  onSetReminder,
  onReviewRisks,
  onRunExtraction,
  onViewObligations,
  onInitiateRenewal,
  maxAlerts = 5,
  className,
}: ContractSmartAlertsProps) {
  
  // Generate automatic alerts based on contract state
  const generatedAlerts = useMemo<SmartAlert[]>(() => {
    const alerts: SmartAlert[] = []
    
    // Expiration alerts
    if (expirationDate) {
      const expDate = new Date(expirationDate)
      const now = new Date()
      const daysRemaining = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysRemaining < 0) {
        alerts.push({
          id: 'expired',
          type: 'critical',
          category: 'expiration',
          title: 'Contract Expired',
          message: `This contract expired ${Math.abs(daysRemaining)} days ago. ${hasRenewalClause ? 'Consider initiating renewal.' : 'Review contract status.'}`,
          actionLabel: hasRenewalClause ? 'Initiate Renewal' : 'Review',
          onAction: hasRenewalClause ? onInitiateRenewal : onSetReminder,
          priority: 100,
          metadata: { daysRemaining },
        })
      } else if (daysRemaining <= 7) {
        alerts.push({
          id: 'expiring-urgent',
          type: 'critical',
          category: 'expiration',
          title: 'Expiring This Week',
          message: `Contract expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. ${autoRenewal ? 'Auto-renewal is enabled.' : 'Take action now.'}`,
          actionLabel: 'Set Reminder',
          onAction: onSetReminder,
          priority: 95,
          metadata: { daysRemaining, deadline: expDate },
        })
      } else if (daysRemaining <= 30) {
        alerts.push({
          id: 'expiring-soon',
          type: 'warning',
          category: 'expiration',
          title: 'Expiring Soon',
          message: `Contract expires in ${daysRemaining} days. Plan ahead for renewal or closure.`,
          actionLabel: 'Set Reminder',
          onAction: onSetReminder,
          priority: 80,
          metadata: { daysRemaining, deadline: expDate },
        })
      } else if (daysRemaining <= 90) {
        alerts.push({
          id: 'expiring-notice',
          type: 'info',
          category: 'expiration',
          title: 'Approaching Expiration',
          message: `Contract expires in ${daysRemaining} days (${expDate.toLocaleDateString()}).`,
          dismissible: true,
          priority: 40,
          metadata: { daysRemaining, deadline: expDate },
        })
      }
    }
    
    // Signature alerts
    if (signatureStatus === 'unsigned') {
      alerts.push({
        id: 'unsigned',
        type: 'critical',
        category: 'signature',
        title: 'Contract Not Signed',
        message: 'This contract has no signatures and may not be legally binding. Request signatures to execute.',
        actionLabel: 'Request Signature',
        onAction: onRequestSignature,
        priority: 90,
      })
    } else if (signatureStatus === 'partially_signed') {
      alerts.push({
        id: 'partial-signature',
        type: 'warning',
        category: 'signature',
        title: 'Awaiting Signatures',
        message: 'Some signatures are still pending. Send reminders to complete execution.',
        actionLabel: 'Send Reminder',
        onAction: onRequestSignature,
        priority: 85,
      })
    }
    
    // Risk alerts
    if (riskLevel === 'high') {
      alerts.push({
        id: 'high-risk',
        type: 'warning',
        category: 'risk',
        title: 'High Risk Contract',
        message: 'This contract has been flagged as high risk. Review risk factors and mitigation strategies.',
        actionLabel: 'Review Risks',
        onAction: onReviewRisks,
        priority: 75,
      })
    }
    
    // Compliance alerts
    if (complianceStatus === 'non_compliant') {
      alerts.push({
        id: 'non-compliant',
        type: 'critical',
        category: 'compliance',
        title: 'Compliance Issue',
        message: 'This contract has been flagged for non-compliance. Immediate review required.',
        actionLabel: 'Review',
        onAction: onReviewRisks,
        priority: 92,
      })
    } else if (complianceStatus === 'review') {
      alerts.push({
        id: 'compliance-review',
        type: 'warning',
        category: 'compliance',
        title: 'Compliance Review Needed',
        message: 'This contract needs compliance verification. Schedule a review.',
        actionLabel: 'Schedule Review',
        onAction: onReviewRisks,
        priority: 70,
      })
    }
    
    // Obligation alerts
    if (overdueObligations && overdueObligations > 0) {
      alerts.push({
        id: 'overdue-obligations',
        type: 'critical',
        category: 'obligation',
        title: 'Overdue Obligations',
        message: `${overdueObligations} obligation${overdueObligations > 1 ? 's are' : ' is'} overdue. Address these immediately.`,
        actionLabel: 'View Obligations',
        onAction: onViewObligations,
        priority: 88,
      })
    } else if (pendingObligations && pendingObligations > 0) {
      alerts.push({
        id: 'pending-obligations',
        type: 'info',
        category: 'obligation',
        title: 'Pending Obligations',
        message: `${pendingObligations} obligation${pendingObligations > 1 ? 's' : ''} pending completion.`,
        actionLabel: 'View',
        onAction: onViewObligations,
        dismissible: true,
        priority: 50,
      })
    }
    
    // Data completeness alerts
    if (!extractionComplete) {
      alerts.push({
        id: 'extraction-needed',
        type: 'info',
        category: 'general',
        title: 'AI Extraction Available',
        message: 'Run AI extraction to automatically populate contract details and identify key terms.',
        actionLabel: 'Run Extraction',
        onAction: onRunExtraction,
        dismissible: true,
        priority: 30,
      })
    }
    
    if (!hasParties) {
      alerts.push({
        id: 'no-parties',
        type: 'warning',
        category: 'general',
        title: 'No Parties Identified',
        message: 'Contract parties have not been identified. Run AI extraction or add manually.',
        actionLabel: 'Add Parties',
        onAction: onRunExtraction,
        priority: 60,
      })
    }
    
    if (contractValue === null || contractValue === undefined) {
      alerts.push({
        id: 'no-value',
        type: 'info',
        category: 'value',
        title: 'No Contract Value',
        message: 'Contract value has not been set. Add value for better tracking and reporting.',
        dismissible: true,
        priority: 25,
      })
    }
    
    // Renewal opportunity
    if (hasRenewalClause && expirationDate) {
      const expDate = new Date(expirationDate)
      const daysRemaining = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysRemaining > 30 && daysRemaining <= 90) {
        alerts.push({
          id: 'renewal-opportunity',
          type: 'opportunity',
          category: 'renewal',
          title: 'Renewal Opportunity',
          message: 'Consider early renewal negotiations to secure favorable terms.',
          actionLabel: 'Initiate Renewal',
          onAction: onInitiateRenewal,
          dismissible: true,
          priority: 35,
        })
      }
    }
    
    return alerts
  }, [
    expirationDate, signatureStatus, contractValue, riskLevel, complianceStatus,
    hasRenewalClause, autoRenewal, pendingObligations, overdueObligations,
    hasParties, extractionComplete, onRequestSignature, onSetReminder,
    onReviewRisks, onRunExtraction, onViewObligations, onInitiateRenewal,
  ])
  
  // Combine and sort alerts by priority
  const allAlerts = useMemo(() => {
    return [...generatedAlerts, ...customAlerts]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxAlerts)
  }, [generatedAlerts, customAlerts, maxAlerts])
  
  if (allAlerts.length === 0) return null
  
  const getAlertStyles = (type: SmartAlert['type']) => {
    switch (type) {
      case 'critical':
        return {
          container: 'bg-red-50 border-red-200',
          icon: 'text-red-600 bg-red-100',
          title: 'text-red-900',
          message: 'text-red-700',
          button: 'text-red-700 hover:text-red-800 hover:bg-red-100',
        }
      case 'warning':
        return {
          container: 'bg-amber-50 border-amber-200',
          icon: 'text-amber-600 bg-amber-100',
          title: 'text-amber-900',
          message: 'text-amber-700',
          button: 'text-amber-700 hover:text-amber-800 hover:bg-amber-100',
        }
      case 'success':
        return {
          container: 'bg-emerald-50 border-emerald-200',
          icon: 'text-emerald-600 bg-emerald-100',
          title: 'text-emerald-900',
          message: 'text-emerald-700',
          button: 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100',
        }
      case 'opportunity':
        return {
          container: 'bg-violet-50 border-violet-200',
          icon: 'text-violet-600 bg-violet-100',
          title: 'text-violet-900',
          message: 'text-violet-700',
          button: 'text-violet-700 hover:text-violet-800 hover:bg-violet-100',
        }
      default: // info
        return {
          container: 'bg-violet-50 border-violet-200',
          icon: 'text-violet-600 bg-violet-100',
          title: 'text-violet-900',
          message: 'text-violet-700',
          button: 'text-violet-700 hover:text-violet-800 hover:bg-violet-100',
        }
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {allAlerts.map((alert, idx) => {
          const styles = getAlertStyles(alert.type)
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                "relative flex items-start gap-3 p-3 sm:p-4 rounded-lg border",
                styles.container
              )}
            >
              {/* Icon */}
              <div className={cn("p-1.5 rounded-md flex-shrink-0", styles.icon)}>
                <AlertIcon type={alert.type} category={alert.category} />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className={cn("text-sm font-medium", styles.title)}>
                    {alert.title}
                  </h4>
                  {alert.type === 'critical' && (
                    <Badge className="text-[10px] bg-red-100 text-red-700 border-0">
                      Urgent
                    </Badge>
                  )}
                  {alert.type === 'opportunity' && (
                    <Badge className="text-[10px] bg-violet-100 text-violet-700 border-0">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      Opportunity
                    </Badge>
                  )}
                </div>
                <p className={cn("text-xs mt-0.5 leading-relaxed", styles.message)}>
                  {alert.message}
                </p>
                
                {/* Action button */}
                {alert.actionLabel && alert.onAction && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={alert.onAction}
                    className={cn("mt-2 text-xs h-7 px-2", styles.button)}
                  >
                    {alert.actionLabel}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
              
              {/* Dismiss button */}
              {alert.dismissible && onDismissAlert && (
                <button
                  onClick={() => onDismissAlert(alert.id)}
                  className={cn(
                    "p-1 rounded-md transition-colors flex-shrink-0",
                    styles.button
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
      
      {/* Summary badge if more alerts */}
      {generatedAlerts.length + customAlerts.length > maxAlerts && (
        <div className="text-center">
          <Badge variant="outline" className="text-xs text-slate-500">
            +{generatedAlerts.length + customAlerts.length - maxAlerts} more alert{generatedAlerts.length + customAlerts.length - maxAlerts > 1 ? 's' : ''}
          </Badge>
        </div>
      )}
    </div>
  )
})

export default ContractSmartAlerts

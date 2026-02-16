'use client'

import React, { memo, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Shield,
  FileSignature,
  Calendar,
  DollarSign,
  Users,
  FileText,
  Sparkles,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface HealthFactor {
  name: string
  score: number // 0-100
  status: 'good' | 'warning' | 'critical'
  message: string
  icon: React.ElementType
}

interface ContractHealthScoreWidgetProps {
  overallScore: number // 0-100
  completeness: number // 0-100
  signatureStatus: 'signed' | 'partially_signed' | 'unsigned' | 'unknown'
  hasExpiration: boolean
  daysToExpiration?: number | null
  hasValue: boolean
  hasParties: boolean
  riskLevel: 'low' | 'medium' | 'high'
  complianceStatus: 'ok' | 'review'
  extractionConfidence?: number
  onViewDetails?: () => void
  onFixIssues?: () => void
  className?: string
}

export const ContractHealthScoreWidget = memo(function ContractHealthScoreWidget({
  overallScore,
  completeness,
  signatureStatus,
  hasExpiration,
  daysToExpiration,
  hasValue,
  hasParties,
  riskLevel,
  complianceStatus: _complianceStatus,
  extractionConfidence,
  onViewDetails,
  onFixIssues,
  className,
}: ContractHealthScoreWidgetProps) {
  
  // Calculate health factors
  const healthFactors = useMemo<HealthFactor[]>(() => {
    const factors: HealthFactor[] = []
    
    // Signature health
    factors.push({
      name: 'Signature',
      score: signatureStatus === 'signed' ? 100 : 
             signatureStatus === 'partially_signed' ? 50 : 
             signatureStatus === 'unsigned' ? 0 : 30,
      status: signatureStatus === 'signed' ? 'good' : 
              signatureStatus === 'partially_signed' ? 'warning' : 'critical',
      message: signatureStatus === 'signed' ? 'Fully executed' :
               signatureStatus === 'partially_signed' ? 'Awaiting signatures' :
               signatureStatus === 'unsigned' ? 'Not signed - not legally binding' :
               'Signature status unknown',
      icon: FileSignature,
    })
    
    // Expiration health
    if (hasExpiration && daysToExpiration !== null && daysToExpiration !== undefined) {
      factors.push({
        name: 'Expiration',
        score: daysToExpiration < 0 ? 0 :
               daysToExpiration <= 30 ? 30 :
               daysToExpiration <= 90 ? 70 : 100,
        status: daysToExpiration < 0 ? 'critical' :
                daysToExpiration <= 30 ? 'critical' :
                daysToExpiration <= 90 ? 'warning' : 'good',
        message: daysToExpiration < 0 ? `Expired ${Math.abs(daysToExpiration)} days ago` :
                 daysToExpiration <= 30 ? `Expires in ${daysToExpiration} days - urgent!` :
                 daysToExpiration <= 90 ? `Expires in ${daysToExpiration} days` :
                 `${daysToExpiration} days remaining`,
        icon: Calendar,
      })
    } else {
      factors.push({
        name: 'Expiration',
        score: hasExpiration ? 100 : 70,
        status: hasExpiration ? 'good' : 'warning',
        message: hasExpiration ? 'Has defined end date' : 'No expiration date - evergreen',
        icon: Calendar,
      })
    }
    
    // Data completeness
    factors.push({
      name: 'Completeness',
      score: completeness,
      status: completeness >= 80 ? 'good' : completeness >= 50 ? 'warning' : 'critical',
      message: completeness >= 80 ? 'Contract data is complete' :
               completeness >= 50 ? 'Some data missing' :
               'Significant data gaps',
      icon: FileText,
    })
    
    // Financial data
    factors.push({
      name: 'Value',
      score: hasValue ? 100 : 30,
      status: hasValue ? 'good' : 'warning',
      message: hasValue ? 'Contract value captured' : 'No value specified',
      icon: DollarSign,
    })
    
    // Parties
    factors.push({
      name: 'Parties',
      score: hasParties ? 100 : 20,
      status: hasParties ? 'good' : 'critical',
      message: hasParties ? 'Parties identified' : 'No parties identified',
      icon: Users,
    })
    
    // Risk assessment
    factors.push({
      name: 'Risk',
      score: riskLevel === 'low' ? 100 : riskLevel === 'medium' ? 60 : 20,
      status: riskLevel === 'low' ? 'good' : riskLevel === 'medium' ? 'warning' : 'critical',
      message: `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk level`,
      icon: Shield,
    })
    
    return factors
  }, [signatureStatus, hasExpiration, daysToExpiration, completeness, hasValue, hasParties, riskLevel])
  
  // Calculate issues count
  const issuesCount = healthFactors.filter(f => f.status !== 'good').length
  const criticalCount = healthFactors.filter(f => f.status === 'critical').length
  
  // Score color and label
  const scoreConfig = useMemo(() => {
    if (overallScore >= 80) return { 
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-500',
      ringColor: 'ring-emerald-200',
      label: 'Excellent',
      gradient: 'from-emerald-500 to-teal-500'
    }
    if (overallScore >= 60) return { 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-500',
      ringColor: 'ring-amber-200',
      label: 'Fair',
      gradient: 'from-amber-500 to-orange-500'
    }
    return { 
      color: 'text-red-600', 
      bgColor: 'bg-red-500',
      ringColor: 'ring-red-200',
      label: 'Needs Attention',
      gradient: 'from-red-500 to-rose-500'
    }
  }, [overallScore])

  return (
    <Card className={cn(
      "overflow-hidden border-0 shadow-sm bg-white",
      className
    )}>
      {/* Header with Score */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Circular Progress */}
            <div className="relative">
              <svg className="w-14 h-14 sm:w-16 sm:h-16 -rotate-90">
                <circle
                  className="text-slate-100"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                  r="26"
                  cx="32"
                  cy="32"
                />
                <motion.circle
                  className={scoreConfig.color}
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="26"
                  cx="32"
                  cy="32"
                  initial={{ strokeDasharray: "0 163" }}
                  animate={{ 
                    strokeDasharray: `${(overallScore / 100) * 163} 163` 
                  }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-lg sm:text-xl font-bold", scoreConfig.color)}>
                  {overallScore}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-semibold text-slate-900">
                  Contract Health
                </h3>
                <Badge className={cn(
                  "text-[10px] sm:text-xs border-0",
                  overallScore >= 80 ? "bg-emerald-100 text-emerald-700" :
                  overallScore >= 60 ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {scoreConfig.label}
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {issuesCount === 0 ? 'All checks passed' :
                 criticalCount > 0 ? `${criticalCount} critical issue${criticalCount > 1 ? 's' : ''} found` :
                 `${issuesCount} item${issuesCount > 1 ? 's' : ''} need attention`}
              </p>
            </div>
          </div>
          
          {/* AI Confidence Badge */}
          {extractionConfidence !== undefined && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] sm:text-xs gap-1 border-violet-200 text-violet-700 bg-violet-50">
                    <Sparkles className="h-3 w-3" />
                    {Math.round(extractionConfidence * 100)}% AI
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>AI extraction confidence score</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      
      {/* Health Factors */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
          {healthFactors.map((factor) => {
            const Icon = factor.icon
            return (
              <TooltipProvider key={factor.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "p-2.5 sm:p-3 rounded-lg border cursor-help transition-colors",
                      factor.status === 'good' ? "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50" :
                      factor.status === 'warning' ? "bg-amber-50/50 border-amber-100 hover:bg-amber-50" :
                      "bg-red-50/50 border-red-100 hover:bg-red-50"
                    )}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn(
                          "h-3.5 w-3.5 sm:h-4 sm:w-4",
                          factor.status === 'good' ? "text-emerald-600" :
                          factor.status === 'warning' ? "text-amber-600" :
                          "text-red-600"
                        )} />
                        <span className="text-[10px] sm:text-xs font-medium text-slate-600">{factor.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {factor.status === 'good' ? (
                          <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500" />
                        ) : factor.status === 'warning' ? (
                          <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
                        )}
                        <span className={cn(
                          "text-[10px] sm:text-xs font-medium",
                          factor.status === 'good' ? "text-emerald-700" :
                          factor.status === 'warning' ? "text-amber-700" :
                          "text-red-700"
                        )}>
                          {factor.status === 'good' ? 'OK' : factor.status === 'warning' ? 'Check' : 'Issue'}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-sm">{factor.message}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          })}
        </div>
        
        {/* Actions */}
        {(issuesCount > 0 || onViewDetails) && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
            {criticalCount > 0 && onFixIssues && (
              <Button
                size="sm"
                variant="default"
                onClick={onFixIssues}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Fix with AI
              </Button>
            )}
            {onViewDetails && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onViewDetails}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                View Details
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  )
})

export default ContractHealthScoreWidget

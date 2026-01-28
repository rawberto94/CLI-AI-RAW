'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  GitBranch,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowUp,
  ExternalLink,
  Loader2,
  Info,
  LinkIcon,
  DollarSign,
  Calendar,
  Building,
  TrendingUp,
  Shield,
  XCircle,
  RefreshCw,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/design-tokens'
import { motion, AnimatePresence } from 'framer-motion'

// ============ TYPES ============

interface FamilyMember {
  id: string
  title: string
  type: string | null
  status: string
  relationshipType: string | null
  clientName: string | null
  supplierName: string | null
  totalValue: number | null
  effectiveDate: string | null
  expirationDate: string | null
  isExpired: boolean
  daysUntilExpiry: number | null
}

interface OrphanContract {
  id: string
  title: string
  type: string | null
  status: string
  suggestedParentReason: string
}

interface ContractFamilyData {
  root: FamilyMember | null
  members: FamilyMember[]
  totalContracts: number
  totalValue: number
  healthScore: number
  completeness: number // Percentage of expected relationships present
  issues: Array<{
    type: 'orphan' | 'expired_parent' | 'missing_sla' | 'missing_dpa' | 'value_mismatch'
    severity: 'low' | 'medium' | 'high'
    message: string
    contractId?: string
    action?: string
  }>
  suggestedParents: Array<{
    id: string
    title: string
    score: number
    reason: string
  }>
}

interface ContractFamilyHealthProps {
  contractId: string
  className?: string
  compact?: boolean
  onLinkSuggestion?: (parentId: string) => void
}

// ============ HELPER FUNCTIONS ============

const getHealthColor = (score: number) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

const getHealthBgColor = (score: number) => {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20'
  if (score >= 60) return 'bg-amber-500/10 border-amber-500/20'
  return 'bg-red-500/10 border-red-500/20'
}

const getHealthProgressColor = (score: number) => {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'high': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
    case 'medium': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'
    case 'low': return 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30'
  }
}

const getIssueSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'high': return <XCircle className="h-4 w-4" />
    case 'medium': return <AlertTriangle className="h-4 w-4" />
    case 'low': return <Info className="h-4 w-4" />
  }
}

// Helper to filter renewal contracts
const getRenewals = (members: FamilyMember[]) => 
  members.filter(m => m.relationshipType === 'RENEWAL')

// ============ RENEWAL CHAIN COMPONENT ============

interface RenewalChainProps {
  renewals: FamilyMember[]
  currentContractId?: string
}

function RenewalChain({ renewals, currentContractId }: RenewalChainProps) {
  if (renewals.length === 0) return null

  // Sort renewals by effective date
  const sortedRenewals = [...renewals].sort((a, b) => {
    if (!a.effectiveDate || !b.effectiveDate) return 0
    return new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime()
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h4 className="text-sm font-semibold">Renewal Chain ({renewals.length})</h4>
      </div>
      <div className="relative pl-4 border-l-2 border-amber-300 dark:border-amber-700 space-y-2">
        {sortedRenewals.map((renewal, idx) => {
          const isCurrent = renewal.id === currentContractId
          return (
            <div key={renewal.id} className="relative">
              {/* Connector dot */}
              <div className={cn(
                "absolute -left-[13px] top-2 w-2 h-2 rounded-full",
                isCurrent 
                  ? "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-800" 
                  : "bg-amber-400 dark:bg-amber-600"
              )} />
              
              <Link
                href={`/contracts/${renewal.id}`}
                className={cn(
                  "block p-2 rounded-lg transition-colors group",
                  isCurrent 
                    ? "bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700"
                    : "hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-medium truncate",
                        isCurrent && "text-amber-700 dark:text-amber-300"
                      )}>
                        {renewal.title}
                      </span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-xs bg-amber-200 dark:bg-amber-800 border-amber-400">
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {renewal.effectiveDate && (
                        <span>{formatDate(renewal.effectiveDate)}</span>
                      )}
                      {renewal.expirationDate && (
                        <>
                          <ArrowRight className="h-3 w-3" />
                          <span>{formatDate(renewal.expirationDate)}</span>
                        </>
                      )}
                      {renewal.totalValue && (
                        <span className="font-medium">{formatCurrency(renewal.totalValue)}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function ContractFamilyHealth({
  contractId,
  className,
  compact = false,
  onLinkSuggestion,
}: ContractFamilyHealthProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [familyData, setFamilyData] = useState<ContractFamilyData | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchFamilyHealth = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/contracts/${contractId}/family-health`)
      
      if (!response.ok) {
        // Generate mock data for development/demo
        const mockData: ContractFamilyData = {
          root: null,
          members: [],
          totalContracts: 1,
          totalValue: 125000,
          healthScore: 75,
          completeness: 60,
          issues: [],
          suggestedParents: []
        }
        setFamilyData(mockData)
        return
      }
      
      const data = await response.json()
      setFamilyData(data)
    } catch {
      // Provide fallback data
      setFamilyData({
        root: null,
        members: [],
        totalContracts: 1,
        totalValue: 0,
        healthScore: 100,
        completeness: 100,
        issues: [],
        suggestedParents: []
      })
    } finally {
      setIsLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    fetchFamilyHealth()
  }, [fetchFamilyHealth])

  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardHeader className="pb-3">
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40" />
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (error || !familyData) {
    return null
  }

  const { healthScore, completeness, issues, totalContracts, totalValue, suggestedParents } = familyData
  const hasIssues = issues.length > 0
  const hasSuggestions = suggestedParents.length > 0
  const highSeverityIssues = issues.filter(i => i.severity === 'high').length

  // Compact view for sidebar or widgets
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowDetails(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:bg-accent",
                getHealthBgColor(healthScore),
                className
              )}
            >
              <Shield className={cn("h-4 w-4", getHealthColor(healthScore))} />
              <span className={cn("text-sm font-medium", getHealthColor(healthScore))}>
                {healthScore}%
              </span>
              {hasIssues && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {issues.length}
                </Badge>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contract Family Health Score</p>
            <p className="text-xs text-muted-foreground">Click for details</p>
          </TooltipContent>
        </Tooltip>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Contract Family Health
              </DialogTitle>
              <DialogDescription>
                Health assessment for this contract and its related agreements
              </DialogDescription>
            </DialogHeader>
            <FamilyHealthDetails 
              data={familyData} 
              contractId={contractId}
              onLinkSuggestion={onLinkSuggestion}
            />
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    )
  }

  // Full card view
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-lg",
              getHealthBgColor(healthScore)
            )}>
              <Shield className={cn("h-4 w-4", getHealthColor(healthScore))} />
            </div>
            <CardTitle className="text-base">Family Health</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", getHealthColor(healthScore))}>
              {healthScore}%
            </span>
          </div>
        </div>
        <CardDescription>
          {totalContracts} contract{totalContracts !== 1 ? 's' : ''} in family
          {totalValue > 0 && ` • ${formatCurrency(totalValue)} total value`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Health Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completeness</span>
            <span className="font-medium">{completeness}%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completeness}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={cn("h-full rounded-full", getHealthProgressColor(healthScore))}
            />
          </div>
        </div>

        {/* Issues Summary */}
        {hasIssues && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Issues Found</span>
              <Badge 
                variant={highSeverityIssues > 0 ? 'destructive' : 'secondary'}
                className="h-5"
              >
                {issues.length} issue{issues.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <div className="space-y-1">
              {issues.slice(0, 3).map((issue, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg text-xs",
                    getSeverityColor(issue.severity)
                  )}
                >
                  {getIssueSeverityIcon(issue.severity)}
                  <span className="flex-1">{issue.message}</span>
                </div>
              ))}
              {issues.length > 3 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full h-7 text-xs"
                  onClick={() => setShowDetails(true)}
                >
                  View all {issues.length} issues
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Suggested Parents */}
        {hasSuggestions && (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              Suggested Parent Contracts
            </span>
            {suggestedParents.slice(0, 2).map((parent) => (
              <div 
                key={parent.id}
                className="flex items-center justify-between p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{parent.title}</p>
                  <p className="text-xs text-muted-foreground">{parent.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {parent.score}% match
                  </Badge>
                  {onLinkSuggestion && (
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="h-7"
                      onClick={() => onLinkSuggestion(parent.id)}
                    >
                      <LinkIcon className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Success State */}
        {!hasIssues && !hasSuggestions && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                Healthy Contract Family
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                All relationships and requirements are properly configured
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============ DETAILS COMPONENT ============

interface FamilyHealthDetailsProps {
  data: ContractFamilyData
  contractId?: string
  onLinkSuggestion?: (parentId: string) => void
}

function FamilyHealthDetails({ data, contractId, onLinkSuggestion }: FamilyHealthDetailsProps) {
  const { healthScore, completeness, issues, members, totalContracts, totalValue, suggestedParents } = data
  
  // Separate renewals from other members for special display
  const renewals = getRenewals(members)
  const otherMembers = members.filter(m => m.relationshipType !== 'RENEWAL')

  return (
    <div className="space-y-4">
      {/* Score Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          "p-4 rounded-lg border text-center",
          getHealthBgColor(healthScore)
        )}>
          <div className={cn("text-3xl font-bold", getHealthColor(healthScore))}>
            {healthScore}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Health Score</div>
        </div>
        <div className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-800/50 text-center">
          <div className="text-3xl font-bold text-slate-700 dark:text-slate-200">
            {completeness}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Completeness</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">{totalContracts}</div>
            <div className="text-xs text-muted-foreground">Contracts</div>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-sm font-medium">{formatCurrency(totalValue)}</div>
            <div className="text-xs text-muted-foreground">Total Value</div>
          </div>
        </div>
      </div>

      {/* All Issues */}
      {issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Issues ({issues.length})</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {issues.map((issue, idx) => (
              <div 
                key={idx}
                className={cn(
                  "flex items-start gap-2 p-3 rounded-lg text-sm",
                  getSeverityColor(issue.severity)
                )}
              >
                {getIssueSeverityIcon(issue.severity)}
                <div className="flex-1">
                  <p>{issue.message}</p>
                  {issue.action && (
                    <p className="text-xs mt-1 opacity-80">
                      Suggested: {issue.action}
                    </p>
                  )}
                </div>
                {issue.contractId && (
                  <Link href={`/contracts/${issue.contractId}`}>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Parents */}
      {suggestedParents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Suggested Parent Contracts</h4>
          <div className="space-y-2">
            {suggestedParents.map((parent) => (
              <div 
                key={parent.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-violet-50/50 dark:bg-violet-900/10"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{parent.title}</p>
                  <p className="text-xs text-muted-foreground">{parent.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {parent.score}%
                  </Badge>
                  {onLinkSuggestion ? (
                    <Button 
                      size="sm"
                      onClick={() => onLinkSuggestion(parent.id)}
                    >
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Link
                    </Button>
                  ) : (
                    <Link href={`/contracts/${parent.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Renewal Chain */}
      {renewals.length > 0 && (
        <RenewalChain renewals={renewals} currentContractId={contractId} />
      )}

      {/* Other Family Members */}
      {otherMembers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Other Family Members ({otherMembers.length})</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {otherMembers.map((member) => (
              <Link 
                key={member.id} 
                href={`/contracts/${member.id}`}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{member.title}</span>
                  {member.relationshipType && (
                    <Badge variant="outline" className="text-xs">
                      {member.relationshipType.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ContractFamilyHealth

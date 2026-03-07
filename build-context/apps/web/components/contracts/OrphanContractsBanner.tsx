'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertTriangle,
  FileText,
  ExternalLink,
  Loader2,
  LinkIcon,
  ChevronRight,
  XCircle,
  Building,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/design-tokens'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ============ TYPES ============

interface SuggestedParent {
  id: string
  title: string
  type: string | null
  score: number
  reason: string
}

interface OrphanContract {
  id: string
  title: string
  type: string | null
  category: string | null
  status: string
  clientName: string | null
  supplierName: string | null
  totalValue: number | null
  effectiveDate: string | null
  expirationDate: string | null
  isExpired: boolean
  suggestedParents: SuggestedParent[]
  suggestedRelationshipType: string
  urgency: 'low' | 'medium' | 'high'
}

interface OrphanStats {
  totalOrphans: number
  withSuggestions: number
  withoutSuggestions: number
  expired: number
  byCategory: Record<string, number>
  totalValue: number
}

interface OrphanContractsBannerProps {
  className?: string
  maxItems?: number
  compact?: boolean
  onRefresh?: () => void
}

// ============ HELPER FUNCTIONS ============

const getUrgencyColor = (urgency: 'low' | 'medium' | 'high') => {
  switch (urgency) {
    case 'high': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
    case 'medium': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30'
    case 'low': return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30'
  }
}

const getRelationshipLabel = (type: string) => {
  const labels: Record<string, string> = {
    'SOW_UNDER_MSA': 'SOW under MSA',
    'SLA_UNDER_MSA': 'SLA under MSA',
    'DPA_UNDER_MSA': 'DPA under MSA',
    'AMENDMENT': 'Amendment',
    'ADDENDUM': 'Addendum',
    'CHANGE_ORDER': 'Change Order',
  }
  return labels[type] || type.replace(/_/g, ' ')
}

// ============ MAIN COMPONENT ============

export function OrphanContractsBanner({
  className,
  maxItems = 5,
  compact = false,
  onRefresh,
}: OrphanContractsBannerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [orphans, setOrphans] = useState<OrphanContract[]>([])
  const [stats, setStats] = useState<OrphanStats | null>(null)
  const [isLinking, setIsLinking] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const fetchOrphans = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/contracts/orphans?limit=${maxItems}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setOrphans(data.orphans || [])
      setStats(data.stats || null)
    } catch {
      setOrphans([])
      setStats(null)
    } finally {
      setIsLoading(false)
    }
  }, [maxItems])

  useEffect(() => {
    fetchOrphans()
  }, [fetchOrphans])

  const handleLinkContract = async (orphanId: string, parentId: string, relationshipType: string) => {
    setIsLinking(orphanId)
    try {
      const response = await fetch(`/api/contracts/${orphanId}/hierarchy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parentContractId: parentId, 
          relationshipType 
        }),
      })
      
      if (!response.ok) throw new Error('Failed to link contract')
      
      toast.success('Contract linked successfully')
      
      // Remove from list
      setOrphans(prev => prev.filter(o => o.id !== orphanId))
      if (stats) {
        setStats({
          ...stats,
          totalOrphans: stats.totalOrphans - 1,
          withSuggestions: stats.withSuggestions - 1
        })
      }
      
      onRefresh?.()
    } catch {
      toast.error('Failed to link contract')
    } finally {
      setIsLinking(null)
    }
  }

  // Don't render if no orphans or dismissed
  if (dismissed || (stats && stats.totalOrphans === 0)) {
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("animate-pulse", className)}>
        <CardContent className="py-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
        </CardContent>
      </Card>
    )
  }

  // No orphans found
  if (!stats || stats.totalOrphans === 0) {
    return null
  }

  // Compact mode - just a badge/button
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/contracts?filter=orphans">
              <Badge 
                variant="secondary" 
                className={cn(
                  "cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30",
                  stats.totalOrphans > 0 && "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                )}
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.totalOrphans} orphan{stats.totalOrphans !== 1 ? 's' : ''}
              </Badge>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>{stats.totalOrphans} contract{stats.totalOrphans !== 1 ? 's' : ''} may need parent links</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full banner
  return (
    <Card className={cn(
      "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base text-amber-900 dark:text-amber-100">
                Orphan Contracts Detected
              </CardTitle>
              <CardDescription className="text-amber-700 dark:text-amber-300">
                {stats.totalOrphans} contract{stats.totalOrphans !== 1 ? 's' : ''} may need to be linked to parent agreements
                {stats.totalValue > 0 && (
                  <span className="ml-1">• {formatCurrency(stats.totalValue)} total value</span>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchOrphans}
              className="h-8 text-amber-700 hover:text-amber-900 dark:text-amber-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDismissed(true)}
              className="h-8 text-amber-700 hover:text-amber-900 dark:text-amber-300"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            <AnimatePresence>
              {orphans.map((orphan, idx) => (
                <motion.div
                  key={orphan.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-amber-200/50 dark:border-amber-800/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <Link 
                          href={`/contracts/${orphan.id}`}
                          className="font-medium text-sm hover:text-violet-600 dark:hover:text-violet-400 truncate"
                        >
                          {orphan.title}
                        </Link>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs flex-shrink-0", getUrgencyColor(orphan.urgency))}
                        >
                          {orphan.urgency}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {orphan.type && (
                          <Badge variant="secondary" className="text-xs">
                            {orphan.type}
                          </Badge>
                        )}
                        {(orphan.clientName || orphan.supplierName) && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {orphan.clientName || orphan.supplierName}
                          </span>
                        )}
                        {orphan.totalValue && (
                          <span>{formatCurrency(orphan.totalValue)}</span>
                        )}
                      </div>

                      {/* Suggested Parents */}
                      {orphan.suggestedParents.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <p className="text-xs text-muted-foreground mb-1.5">
                            Suggested: Link as {getRelationshipLabel(orphan.suggestedRelationshipType)}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {orphan.suggestedParents.slice(0, 2).map((parent) => (
                              <Button
                                key={parent.id}
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1.5"
                                disabled={isLinking === orphan.id}
                                onClick={() => handleLinkContract(
                                  orphan.id, 
                                  parent.id, 
                                  orphan.suggestedRelationshipType
                                )}
                              >
                                {isLinking === orphan.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <LinkIcon className="h-3 w-3" />
                                )}
                                <span className="truncate max-w-[120px]">{parent.title}</span>
                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                  {parent.score}%
                                </Badge>
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Link href={`/contracts/${orphan.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {stats.totalOrphans > maxItems && (
          <div className="mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/50">
            <Link href="/contracts?filter=orphans">
              <Button variant="outline" size="sm" className="w-full">
                View all {stats.totalOrphans} orphan contracts
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default OrphanContractsBanner

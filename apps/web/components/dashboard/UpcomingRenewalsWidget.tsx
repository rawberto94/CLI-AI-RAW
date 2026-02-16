'use client'

/**
 * Upcoming Renewals Widget
 * 
 * Dashboard widget showing contracts approaching renewal dates
 * with action buttons and priority indicators.
 */

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  CalendarClock,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  ChevronRight,
  Bell,
  Mail,
  MoreHorizontal,
  ArrowUpRight,
  Building,
  FileText,
  Filter,
  Calendar,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ============ TYPES ============

export type RenewalUrgency = 'critical' | 'high' | 'medium' | 'low'
export type RenewalStatus = 'pending' | 'in_progress' | 'initiated' | 'completed' | 'declined'

export interface RenewalContract {
  id: string
  name: string
  supplier?: string
  value: number
  currency?: string
  expirationDate: Date
  daysRemaining: number
  autoRenewal: boolean
  noticePeriodDays?: number
  renewalStatus: RenewalStatus
  lastRenewalDate?: Date
  renewalCount?: number
}

interface UpcomingRenewalsWidgetProps {
  renewals?: RenewalContract[]
  onInitiateRenewal?: (id: string) => void
  onSetReminder?: (id: string) => void
  onViewContract?: (id: string) => void
  showFilters?: boolean
  maxItems?: number
  className?: string
  variant?: 'card' | 'compact'
}

// ============ HELPERS ============

const getUrgency = (daysRemaining: number, noticePeriodDays?: number): RenewalUrgency => {
  const noticeThreshold = noticePeriodDays ?? 30
  if (daysRemaining <= 0) return 'critical'
  if (daysRemaining <= noticeThreshold) return 'critical'
  if (daysRemaining <= noticeThreshold * 2) return 'high'
  if (daysRemaining <= 60) return 'medium'
  return 'low'
}

const URGENCY_CONFIG = {
  critical: { 
    color: 'text-red-600', 
    bg: 'bg-red-50', 
    border: 'border-red-200',
    icon: AlertTriangle,
    label: 'Critical'
  },
  high: { 
    color: 'text-orange-600', 
    bg: 'bg-orange-50', 
    border: 'border-orange-200',
    icon: Clock,
    label: 'High Priority'
  },
  medium: { 
    color: 'text-amber-600', 
    bg: 'bg-amber-50', 
    border: 'border-amber-200',
    icon: CalendarClock,
    label: 'Medium'
  },
  low: { 
    color: 'text-slate-600', 
    bg: 'bg-slate-50', 
    border: 'border-slate-200',
    icon: Calendar,
    label: 'Upcoming'
  },
}

const STATUS_CONFIG = {
  pending: { color: 'text-slate-600', bg: 'bg-slate-100', label: 'Pending' },
  initiated: { color: 'text-violet-600', bg: 'bg-violet-100', label: 'Initiated' },
  in_progress: { color: 'text-violet-600', bg: 'bg-violet-100', label: 'In Progress' },
  completed: { color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
  declined: { color: 'text-red-600', bg: 'bg-red-100', label: 'Declined' },
}

const formatCurrency = (value: number, currency = 'CHF'): string => {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============ SUB-COMPONENTS ============

interface RenewalItemProps {
  renewal: RenewalContract
  onInitiateRenewal?: (id: string) => void
  onSetReminder?: (id: string) => void
  variant?: 'card' | 'compact'
}

function RenewalItem({ 
  renewal, 
  
  onInitiateRenewal, 
  onSetReminder, 
  variant = 'card' 
}: RenewalItemProps) {
  const urgency = getUrgency(renewal.daysRemaining, renewal.noticePeriodDays)
  const urgencyConfig = URGENCY_CONFIG[urgency]
  const statusConfig = STATUS_CONFIG[renewal.renewalStatus]
  const UrgencyIcon = urgencyConfig.icon
  
  const isCompact = variant === 'compact'
  const isPastDue = renewal.daysRemaining <= 0
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative rounded-lg border transition-all hover:shadow-sm",
        urgencyConfig.border,
        isCompact ? "p-2" : "p-3"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Urgency indicator */}
        <div className={cn(
          "flex-shrink-0 rounded-lg p-2",
          urgencyConfig.bg
        )}>
          <UrgencyIcon className={cn("h-4 w-4", urgencyConfig.color)} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link 
              href={`/contracts/${renewal.id}`}
              className={cn(
                "font-medium hover:text-violet-600 truncate",
                isCompact ? "text-xs" : "text-sm"
              )}
            >
              {renewal.name}
            </Link>
            {renewal.autoRenewal && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-200 text-green-600">
                Auto
              </Badge>
            )}
          </div>
          
          {!isCompact && (
            <>
              {renewal.supplier && (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500">
                  <Building className="h-3 w-3" />
                  <span className="truncate">{renewal.supplier}</span>
                </div>
              )}
              
              <div className="flex items-center gap-3 mt-2">
                {/* Days remaining */}
                <div className={cn("flex items-center gap-1 text-xs font-medium", urgencyConfig.color)}>
                  {isPastDue ? (
                    <>
                      <AlertTriangle className="h-3 w-3" />
                      {Math.abs(renewal.daysRemaining)}d overdue
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      {renewal.daysRemaining}d remaining
                    </>
                  )}
                </div>
                
                {/* Value */}
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(renewal.value, renewal.currency)}
                </div>
                
                {/* Status */}
                <Badge className={cn("text-[10px]", statusConfig.bg, statusConfig.color)}>
                  {statusConfig.label}
                </Badge>
              </div>
            </>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1">
          {renewal.renewalStatus === 'pending' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={`/contracts/${renewal.id}/renew`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 opacity-0 group-hover:opacity-100"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Initiate Renewal</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${renewal.id}`} className="flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  View Contract
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetReminder?.(renewal.id)}>
                <Bell className="h-4 w-4 mr-2" />
                Set Reminder
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="h-4 w-4 mr-2" />
                Contact Supplier
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/contracts/${renewal.id}/renew`} className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Initiate Renewal
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Progress bar showing time until expiration */}
      {!isCompact && renewal.noticePeriodDays && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span>Notice period: {renewal.noticePeriodDays}d</span>
            <span>Expires: {formatDate(renewal.expirationDate)}</span>
          </div>
          <Progress 
            value={Math.max(0, Math.min(100, (renewal.daysRemaining / 90) * 100))} 
            className="h-1"
          />
        </div>
      )}
    </motion.div>
  )
}

// ============ SUMMARY STATS ============

interface RenewalSummaryProps {
  renewals: RenewalContract[]
}

function RenewalSummary({ renewals }: RenewalSummaryProps) {
  const stats = {
    critical: renewals.filter(r => getUrgency(r.daysRemaining, r.noticePeriodDays) === 'critical').length,
    high: renewals.filter(r => getUrgency(r.daysRemaining, r.noticePeriodDays) === 'high').length,
    totalValue: renewals.reduce((sum, r) => sum + r.value, 0),
    autoRenewal: renewals.filter(r => r.autoRenewal).length,
  }
  
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      <div className="text-center p-2 bg-red-50 rounded-lg">
        <div className="text-lg font-bold text-red-600">{stats.critical}</div>
        <div className="text-[10px] text-red-600">Critical</div>
      </div>
      <div className="text-center p-2 bg-orange-50 rounded-lg">
        <div className="text-lg font-bold text-orange-600">{stats.high}</div>
        <div className="text-[10px] text-orange-600">High</div>
      </div>
      <div className="text-center p-2 bg-violet-50 rounded-lg">
        <div className="text-lg font-bold text-violet-600">{formatCurrency(stats.totalValue)}</div>
        <div className="text-[10px] text-violet-600">At Risk</div>
      </div>
      <div className="text-center p-2 bg-green-50 rounded-lg">
        <div className="text-lg font-bold text-green-600">{stats.autoRenewal}</div>
        <div className="text-[10px] text-green-600">Auto</div>
      </div>
    </div>
  )
}

// ============ MAIN COMPONENT ============

export function UpcomingRenewalsWidget({
  renewals = [],
  onInitiateRenewal,
  onSetReminder,
  onViewContract,
  showFilters = false,
  maxItems = 5,
  className,
  variant = 'card',
}: UpcomingRenewalsWidgetProps) {
  const [filter, setFilter] = useState<'all' | RenewalUrgency>('all')
  const [loading, setLoading] = useState(false)
  
  // Filter and sort renewals
  const filteredRenewals = renewals
    .filter(r => filter === 'all' || getUrgency(r.daysRemaining, r.noticePeriodDays) === filter)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, maxItems)
  
  const hasMore = renewals.length > maxItems
  
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 bg-orange-100 rounded-lg">
              <CalendarClock className="h-4 w-4 text-orange-600" />
            </div>
            Upcoming Renewals
            <Badge variant="secondary" className="ml-2">
              {renewals.length}
            </Badge>
          </CardTitle>
          
          {showFilters && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  {filter === 'all' ? 'All' : URGENCY_CONFIG[filter].label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setFilter('all')}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('critical')}>Critical</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('high')}>High Priority</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('medium')}>Medium</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('low')}>Upcoming</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {renewals.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No upcoming renewals</p>
            <p className="text-xs text-slate-400 mt-1">All contracts are up to date</p>
          </div>
        ) : (
          <>
            <RenewalSummary renewals={renewals} />
            
            <div className="space-y-2">
              <AnimatePresence>
                {filteredRenewals.map(renewal => (
                  <RenewalItem
                    key={renewal.id}
                    renewal={renewal}
                    onInitiateRenewal={onInitiateRenewal}
                    onSetReminder={onSetReminder}
                    variant={variant}
                  />
                ))}
              </AnimatePresence>
            </div>
            
            {hasMore && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/renewals">
                  <Button variant="ghost" className="w-full justify-center text-sm">
                    View all {renewals.length} renewals
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default UpcomingRenewalsWidget

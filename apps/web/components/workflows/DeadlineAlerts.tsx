'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, X, ChevronRight, Bell, Calendar } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    layout?: boolean;
    className?: string;
    key?: string;
  }
>;

interface DeadlineItem {
  id: string;
  title: string;
  dueDate: Date;
  type: 'approval' | 'renewal' | 'contract';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  link: string;
  assignee?: string;
}

interface DeadlineAlertBannerProps {
  items: DeadlineItem[];
  onDismiss?: (id: string) => void;
  className?: string;
}

/**
 * Deadline Alert Banner - Shows urgent deadlines at top of page
 */
export function DeadlineAlertBanner({ items, onDismiss, className }: DeadlineAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const visibleItems = items.filter(item => !dismissed.has(item.id));
  const urgentItems = visibleItems.filter(item => item.priority === 'urgent');
  
  if (visibleItems.length === 0) return null;
  
  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    onDismiss?.(id);
  };
  
  const getTimeRemaining = (dueDate: Date) => {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    
    if (diff <= 0) return { text: 'Overdue', isOverdue: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return { text: `${days}d remaining`, isOverdue: false };
    if (hours > 0) return { text: `${hours}h remaining`, isOverdue: false };
    
    const minutes = Math.floor(diff / (1000 * 60));
    return { text: `${minutes}m remaining`, isOverdue: false };
  };
  
  // Show just the most urgent item in compact mode
  const primaryItem = urgentItems[0] || visibleItems[0];
  const remaining = visibleItems.length - 1;
  
  if (!primaryItem) {
    return null;
  }
  
  return (
    <AnimatePresence>
      <MotionDiv
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "relative overflow-hidden rounded-lg border-2",
          primaryItem.priority === 'urgent' ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300',
          className
        )}
        role="alert"
        aria-live="polite"
        aria-label={`${visibleItems.length} deadline alert${visibleItems.length > 1 ? 's' : ''}`}
      >
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "p-2 rounded-lg",
                primaryItem.priority === 'urgent' ? 'bg-red-100' : 'bg-amber-100'
              )}>
                {primaryItem.priority === 'urgent' ? (
                  <AlertTriangle className="w-5 h-5 text-red-600 animate-pulse" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-600" />
                )}
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-sm font-semibold",
                    primaryItem.priority === 'urgent' ? 'text-red-900' : 'text-amber-900'
                  )}>
                    {getTimeRemaining(primaryItem.dueDate).isOverdue ? 'OVERDUE:' : 'Deadline:'}
                  </span>
                  <Link 
                    href={primaryItem.link}
                    className={cn(
                      "text-sm font-medium hover:underline truncate",
                      primaryItem.priority === 'urgent' ? 'text-red-700' : 'text-amber-700'
                    )}
                  >
                    {primaryItem.title}
                  </Link>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs">
                  <span className={cn(
                    "font-medium",
                    getTimeRemaining(primaryItem.dueDate).isOverdue 
                      ? 'text-red-600' 
                      : primaryItem.priority === 'urgent' ? 'text-red-600' : 'text-amber-600'
                  )}>
                    {getTimeRemaining(primaryItem.dueDate).text}
                  </span>
                  <span className={cn(
                    primaryItem.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
                  )}>
                    •
                  </span>
                  <span className={cn(
                    "capitalize",
                    primaryItem.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
                  )}>
                    {primaryItem.type}
                  </span>
                  {primaryItem.assignee && (
                    <>
                      <span className={cn(
                        primaryItem.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
                      )}>
                        •
                      </span>
                      <span className={cn(
                        primaryItem.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
                      )}>
                        Assigned: {primaryItem.assignee}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {remaining > 0 && (
                <Link 
                  href="/approvals"
                  className={cn(
                    "px-2 py-1 rounded text-xs font-medium flex items-center gap-1",
                    primaryItem.priority === 'urgent' 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  )}
                >
                  +{remaining} more
                  <ChevronRight className="w-3 h-3" />
                </Link>
              )}
              <button
                onClick={() => handleDismiss(primaryItem.id)}
                className={cn(
                  "p-1 rounded hover:bg-white/50",
                  primaryItem.priority === 'urgent' ? 'text-red-500' : 'text-amber-500'
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Progress bar for time remaining */}
        {!getTimeRemaining(primaryItem.dueDate).isOverdue && (
          <div className={cn(
            "h-1",
            primaryItem.priority === 'urgent' ? 'bg-red-200' : 'bg-amber-200'
          )}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.5 }}
              className={cn(
                "h-full",
                primaryItem.priority === 'urgent' ? 'bg-red-500' : 'bg-amber-500'
              )}
            />
          </div>
        )}
      </MotionDiv>
    </AnimatePresence>
  );
}

interface DeadlineAlertCardProps {
  item: DeadlineItem;
  compact?: boolean;
  onAction?: () => void;
  className?: string;
}

/**
 * Deadline Alert Card - For showing in lists/grids
 */
export function DeadlineAlertCard({ item, compact = false, onAction, className }: DeadlineAlertCardProps) {
  const getTimeRemaining = (dueDate: Date) => {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    
    if (diff <= 0) return { text: 'Overdue', isOverdue: true, urgency: 'critical' };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 7) return { text: `${days} days`, isOverdue: false, urgency: 'low' };
    if (days > 2) return { text: `${days} days`, isOverdue: false, urgency: 'medium' };
    if (days > 0) return { text: `${days}d ${hours % 24}h`, isOverdue: false, urgency: 'high' };
    if (hours > 0) return { text: `${hours} hours`, isOverdue: false, urgency: 'critical' };
    
    const minutes = Math.floor(diff / (1000 * 60));
    return { text: `${minutes} min`, isOverdue: false, urgency: 'critical' };
  };
  
  const timeInfo = getTimeRemaining(item.dueDate);
  
  const urgencyStyles = {
    critical: 'border-red-300 bg-red-50',
    high: 'border-orange-300 bg-orange-50',
    medium: 'border-amber-300 bg-amber-50',
    low: 'border-slate-200 bg-slate-50',
  };
  
  const iconStyles = {
    critical: 'text-red-500',
    high: 'text-orange-500',
    medium: 'text-amber-500',
    low: 'text-slate-400',
  };
  
  if (compact) {
    return (
      <Link
        href={item.link}
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg border transition-colors hover:shadow-sm",
          urgencyStyles[timeInfo.urgency as keyof typeof urgencyStyles],
          className
        )}
      >
        <Clock className={cn("w-4 h-4", iconStyles[timeInfo.urgency as keyof typeof iconStyles])} />
        <span className="text-xs font-medium truncate">{item.title}</span>
        <span className={cn(
          "text-xs font-bold ml-auto",
          timeInfo.isOverdue ? 'text-red-600' : iconStyles[timeInfo.urgency as keyof typeof iconStyles]
        )}>
          {timeInfo.text}
        </span>
      </Link>
    );
  }
  
  return (
    <div className={cn(
      "p-4 rounded-xl border-2 transition-all",
      urgencyStyles[timeInfo.urgency as keyof typeof urgencyStyles],
      className
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            timeInfo.urgency === 'critical' ? 'bg-red-100' :
            timeInfo.urgency === 'high' ? 'bg-orange-100' :
            timeInfo.urgency === 'medium' ? 'bg-amber-100' : 'bg-slate-100'
          )}>
            {timeInfo.isOverdue ? (
              <AlertTriangle className={cn("w-5 h-5 animate-pulse", iconStyles[timeInfo.urgency as keyof typeof iconStyles])} />
            ) : (
              <Clock className={cn("w-5 h-5", iconStyles[timeInfo.urgency as keyof typeof iconStyles])} />
            )}
          </div>
          
          <div>
            <Link 
              href={item.link}
              className="font-semibold text-slate-900 hover:underline line-clamp-1"
            >
              {item.title}
            </Link>
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              <span className="capitalize">{item.type}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {item.dueDate.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className={cn(
            "text-lg font-bold",
            timeInfo.isOverdue ? 'text-red-600' : iconStyles[timeInfo.urgency as keyof typeof iconStyles]
          )}>
            {timeInfo.text}
          </div>
          {timeInfo.isOverdue && (
            <span className="text-xs text-red-500 font-medium">ACTION REQUIRED</span>
          )}
        </div>
      </div>
      
      {onAction && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          <button
            onClick={onAction}
            className={cn(
              "w-full py-2 rounded-lg font-medium text-sm transition-colors",
              timeInfo.urgency === 'critical' 
                ? 'bg-red-500 text-white hover:bg-red-600'
                : timeInfo.urgency === 'high'
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            )}
          >
            Take Action
          </button>
        </div>
      )}
    </div>
  );
}

interface DeadlineIndicatorProps {
  dueDate: Date;
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

/**
 * Deadline Indicator - Inline badge/indicator for deadline status
 */
export function DeadlineIndicator({ dueDate, size = 'md', showText = true, className }: DeadlineIndicatorProps) {
  const getTimeRemaining = () => {
    const now = new Date();
    const diff = dueDate.getTime() - now.getTime();
    
    if (diff <= 0) return { text: 'Overdue', urgency: 'critical' };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 7) return { text: `${days}d`, urgency: 'low' };
    if (days > 2) return { text: `${days}d`, urgency: 'medium' };
    if (days > 0) return { text: `${days}d`, urgency: 'high' };
    if (hours > 0) return { text: `${hours}h`, urgency: 'critical' };
    
    const minutes = Math.floor(diff / (1000 * 60));
    return { text: `${minutes}m`, urgency: 'critical' };
  };
  
  const timeInfo = getTimeRemaining();
  
  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  
  const urgencyStyles = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-medium",
      sizeStyles[size],
      urgencyStyles[timeInfo.urgency as keyof typeof urgencyStyles],
      className
    )}>
      {timeInfo.urgency === 'critical' ? (
        <AlertTriangle className={cn(iconSize, "animate-pulse")} />
      ) : (
        <Clock className={iconSize} />
      )}
      {showText && <span>{timeInfo.text}</span>}
    </span>
  );
}

/**
 * Hook for generating deadline alerts from various data sources
 */
export function useDeadlineAlerts(approvals?: any[], renewals?: any[], contracts?: any[]) {
  const [alerts, setAlerts] = useState<DeadlineItem[]>([]);
  
  useEffect(() => {
    const items: DeadlineItem[] = [];
    const now = new Date();
    
    // Process approvals
    approvals?.forEach(approval => {
      if (approval.dueDate && approval.status === 'pending') {
        const dueDate = new Date(approval.dueDate);
        const daysRemaining = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        items.push({
          id: `approval-${approval.id}`,
          title: approval.title || approval.contractName || 'Approval Required',
          dueDate,
          type: 'approval',
          priority: daysRemaining < 0 ? 'urgent' : daysRemaining <= 1 ? 'urgent' : daysRemaining <= 3 ? 'high' : 'medium',
          link: `/approvals?id=${approval.id}`,
          assignee: approval.currentApprover,
        });
      }
    });
    
    // Process renewals
    renewals?.forEach(renewal => {
      if (renewal.renewalDate || renewal.noticeDeadline) {
        const deadlineDate = renewal.noticeDeadline 
          ? new Date(renewal.noticeDeadline) 
          : new Date(renewal.renewalDate);
        const daysRemaining = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 30) {
          items.push({
            id: `renewal-${renewal.id}`,
            title: renewal.contractName || renewal.title || 'Renewal Due',
            dueDate: deadlineDate,
            type: 'renewal',
            priority: daysRemaining < 0 ? 'urgent' : daysRemaining <= 7 ? 'urgent' : daysRemaining <= 14 ? 'high' : 'medium',
            link: `/contracts/${renewal.id}`,
            assignee: renewal.assignee?.name,
          });
        }
      }
    });
    
    // Process contract expirations
    contracts?.forEach(contract => {
      if (contract.expirationDate) {
        const expirationDate = new Date(contract.expirationDate);
        const daysRemaining = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining <= 60) {
          items.push({
            id: `contract-${contract.id}`,
            title: contract.title || contract.name || 'Contract Expiring',
            dueDate: expirationDate,
            type: 'contract',
            priority: daysRemaining < 0 ? 'urgent' : daysRemaining <= 14 ? 'urgent' : daysRemaining <= 30 ? 'high' : 'medium',
            link: `/contracts/${contract.id}`,
          });
        }
      }
    });
    
    // Sort by due date (soonest first)
    items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    
    setAlerts(items);
  }, [approvals, renewals, contracts]);
  
  return alerts;
}

export default DeadlineAlertBanner;

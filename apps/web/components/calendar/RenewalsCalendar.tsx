'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Building2,
  DollarSign,
  ExternalLink,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types
interface RenewalContract {
  id: string;
  contractId: string;
  contractName: string;
  supplierName: string;
  currentValue: number;
  projectedValue: number;
  renewalDate: string;
  autoRenewal: boolean;
  noticeDeadline?: string;
  status: 'upcoming' | 'in-progress' | 'completed' | 'lapsed' | 'terminated';
  renewalType: 'auto' | 'manual' | 'negotiated';
  healthScore: number;
  daysUntilRenewal: number;
  recommendation: 'renew' | 'renegotiate' | 'terminate' | 'review';
  risks: string[];
  savings?: {
    potential: number;
    realized: number;
  };
}

interface RenewalsCalendarProps {
  renewals: RenewalContract[];
  onSelect?: (renewal: RenewalContract) => void;
  selectedId?: string | null;
}

// Status colors
const statusColors = {
  'upcoming': 'bg-violet-500',
  'in-progress': 'bg-violet-500',
  'completed': 'bg-green-500',
  'lapsed': 'bg-red-500',
  'terminated': 'bg-slate-500',
};

const statusBadgeColors = {
  'upcoming': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'in-progress': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'completed': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'lapsed': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'terminated': 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const recommendationColors = {
  'renew': 'text-green-600 dark:text-green-400',
  'renegotiate': 'text-amber-600 dark:text-amber-400',
  'terminate': 'text-red-600 dark:text-red-400',
  'review': 'text-violet-600 dark:text-violet-400',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function RenewalsCalendar({ renewals, onSelect, selectedId }: RenewalsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'quarter'>('month');

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: 
          date.getDate() === today.getDate() &&
          date.getMonth() === today.getMonth() &&
          date.getFullYear() === today.getFullYear(),
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false,
      });
    }
    
    return days;
  }, [currentDate]);

  // Get renewals for a specific date
  const getRenewalsForDate = useCallback((date: Date, field: 'renewalDate' | 'noticeDeadline' = 'renewalDate') => {
    const dateStr = date.toISOString().split('T')[0];
    return renewals.filter(r => {
      const renewalDateStr = field === 'noticeDeadline' && r.noticeDeadline 
        ? new Date(r.noticeDeadline).toISOString().split('T')[0]
        : new Date(r.renewalDate).toISOString().split('T')[0];
      return renewalDateStr === dateStr;
    });
  }, [renewals]);

  // Check if date has notice deadline
  const hasNoticeDeadline = useCallback((date: Date) => {
    return getRenewalsForDate(date, 'noticeDeadline').length > 0;
  }, [getRenewalsForDate]);

  // Navigate
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Selected date renewals
  const selectedDateRenewals = selectedDate ? getRenewalsForDate(selectedDate) : [];
  const selectedDateNotices = selectedDate ? getRenewalsForDate(selectedDate, 'noticeDeadline') : [];

  // Month stats
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthRenewals = renewals.filter(r => {
      const date = new Date(r.renewalDate);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    
    return {
      total: monthRenewals.length,
      totalValue: monthRenewals.reduce((sum, r) => sum + r.currentValue, 0),
      autoRenewal: monthRenewals.filter(r => r.autoRenewal).length,
      urgent: monthRenewals.filter(r => r.daysUntilRenewal <= 30).length,
      potentialSavings: monthRenewals.reduce((sum, r) => sum + (r.savings?.potential || 0), 0),
    };
  }, [renewals, currentDate]);

  // Quarter view data
  const quarterData = useMemo(() => {
    if (viewMode !== 'quarter') return [];
    
    const year = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const quarterStart = Math.floor(currentMonth / 3) * 3;
    
    const months = [];
    for (let i = 0; i < 3; i++) {
      const month = quarterStart + i;
      const monthRenewals = renewals.filter(r => {
        const date = new Date(r.renewalDate);
        return date.getFullYear() === year && date.getMonth() === month;
      });
      months.push({
        month,
        name: MONTHS[month],
        renewals: monthRenewals,
        totalValue: monthRenewals.reduce((sum, r) => sum + r.currentValue, 0),
      });
    }
    return months;
  }, [renewals, currentDate, viewMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 min-w-[200px] text-center">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Month Stats */}
          <div className="hidden lg:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-4 h-4 text-violet-500" />
              <span className="text-slate-600 dark:text-slate-400">{monthStats.total} Renewals</span>
            </div>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-slate-600 dark:text-slate-400">{formatCurrency(monthStats.totalValue)}</span>
            </div>
            {monthStats.urgent > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400">{monthStats.urgent} Urgent</span>
              </div>
            )}
          </div>
          
          {/* View Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === 'month' 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === 'quarter'
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
              onClick={() => setViewMode('quarter')}
            >
              Quarter
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardContent className="p-4">
            {viewMode === 'month' ? (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-7 mb-2">
                  {DAYS.map(day => (
                    <div key={day} className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarData.map((day, index) => {
                    const dayRenewals = getRenewalsForDate(day.date);
                    const dayNotices = getRenewalsForDate(day.date, 'noticeDeadline');
                    const hasRenewals = dayRenewals.length > 0;
                    const hasNotices = dayNotices.length > 0;
                    const hasUrgent = dayRenewals.some(r => r.daysUntilRenewal <= 14);
                    const hasAutoRenewal = dayRenewals.some(r => r.autoRenewal);
                    const isSelected = selectedDate?.toDateString() === day.date.toDateString();
                    
                    return (
                      <TooltipProvider key={index}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => setSelectedDate(day.date)}
                              className={cn(
                                "relative h-20 p-1 rounded-lg border transition-all text-left flex flex-col",
                                day.isCurrentMonth 
                                  ? "bg-white dark:bg-slate-800" 
                                  : "bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600",
                                day.isToday && "ring-2 ring-green-500 ring-offset-1",
                                isSelected && "border-green-500 bg-green-50 dark:bg-green-900/20",
                                !isSelected && "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                              )}
                            >
                              <span className={cn(
                                "text-sm font-medium",
                                day.isToday && "text-green-600 dark:text-green-400"
                              )}>
                                {day.date.getDate()}
                              </span>
                              
                              {(hasRenewals || hasNotices) && (
                                <div className="flex flex-wrap gap-0.5 mt-1 flex-1">
                                  {dayRenewals.slice(0, 2).map((r, i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        statusColors[r.status]
                                      )}
                                    />
                                  ))}
                                  {dayNotices.length > 0 && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-amber-300" />
                                  )}
                                  {dayRenewals.length > 2 && (
                                    <span className="text-[10px] text-slate-500">+{dayRenewals.length - 2}</span>
                                  )}
                                </div>
                              )}
                              
                              {/* Indicators */}
                              <div className="absolute top-1 right-1 flex gap-0.5">
                                {hasUrgent && (
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                )}
                                {hasAutoRenewal && (
                                  <RefreshCw className="w-3 h-3 text-amber-500" />
                                )}
                              </div>
                            </button>
                          </TooltipTrigger>
                          {(hasRenewals || hasNotices) && (
                            <TooltipContent side="bottom" className="max-w-xs">
                              {hasRenewals && (
                                <div className="mb-2">
                                  <p className="font-medium mb-1">{dayRenewals.length} renewal{dayRenewals.length > 1 ? 's' : ''}</p>
                                  <ul className="text-xs space-y-1">
                                    {dayRenewals.slice(0, 3).map((r, i) => (
                                      <li key={i} className="flex items-center gap-1">
                                        <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[r.status])} />
                                        <span className="truncate">{r.contractName}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {hasNotices && (
                                <div>
                                  <p className="font-medium text-amber-600 mb-1">⚠️ Notice Deadline</p>
                                  <ul className="text-xs space-y-1">
                                    {dayNotices.map((r, i) => (
                                      <li key={i}>{r.contractName}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Quarter View */
              <div className="space-y-6">
                {quarterData.map(({ month, name, renewals: monthRenewals, totalValue }) => (
                  <div key={month} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{name}</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-slate-500">{monthRenewals.length} renewals</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalValue)}</span>
                      </div>
                    </div>
                    {monthRenewals.length > 0 ? (
                      <div className="space-y-2">
                        {monthRenewals.map(renewal => (
                          <RenewalCard 
                            key={renewal.id} 
                            renewal={renewal}
                            isSelected={selectedId === renewal.id}
                            onSelect={onSelect}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 text-sm">
                        No renewals this month
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-green-500" />
              {selectedDate ? (
                <>
                  {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'long', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </>
              ) : (
                'Select a date'
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {selectedDate ? (
              <AnimatePresence mode="wait">
                {(selectedDateRenewals.length > 0 || selectedDateNotices.length > 0) ? (
                  <motion.div key="RenewalsCalendar-ap-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4 max-h-[400px] overflow-y-auto"
                  >
                    {selectedDateNotices.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          Notice Deadline
                        </div>
                        {selectedDateNotices.map(r => (
                          <div key={r.id} className="text-sm text-amber-800 dark:text-amber-300">
                            {r.contractName} - Take action to avoid auto-renewal
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedDateRenewals.map(renewal => (
                      <RenewalCard 
                        key={renewal.id} 
                        renewal={renewal}
                        isSelected={selectedId === renewal.id}
                        onSelect={onSelect}
                        detailed
                      />
                    ))}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No renewals on this date</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click on a date to see renewals</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Status:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-slate-600 dark:text-slate-400">Upcoming</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
              <span className="text-slate-600 dark:text-slate-400">In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-slate-600 dark:text-slate-400">Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-1 ring-amber-300" />
              <span className="text-slate-600 dark:text-slate-400">Notice Deadline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-slate-600 dark:text-slate-400">Auto-Renewal</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Renewal Card Component
function RenewalCard({ 
  renewal, 
  isSelected = false,
  onSelect,
  detailed = false
}: { 
  renewal: RenewalContract;
  isSelected?: boolean;
  onSelect?: (renewal: RenewalContract) => void;
  detailed?: boolean;
}) {
  return (
    <div 
      className={cn(
        "p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
        isSelected 
          ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50"
      )}
      onClick={() => onSelect?.(renewal)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0", statusBadgeColors[renewal.status])}
            >
              {renewal.status}
            </Badge>
            {renewal.autoRenewal && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                <RefreshCw className="w-2.5 h-2.5 mr-1" />
                Auto
              </Badge>
            )}
            {renewal.daysUntilRenewal <= 14 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">
                {renewal.daysUntilRenewal}d
              </Badge>
            )}
          </div>
          
          <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">
            {renewal.contractName}
          </h4>
          
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <Building2 className="w-3 h-3" />
            {renewal.supplierName}
          </div>
          
          {detailed && (
            <>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3 text-green-500" />
                  <span className="text-slate-600 dark:text-slate-400">{formatCurrency(renewal.currentValue)}</span>
                </div>
                {renewal.projectedValue !== renewal.currentValue && (
                  <div className="flex items-center gap-1">
                    {renewal.projectedValue > renewal.currentValue ? (
                      <TrendingUp className="w-3 h-3 text-red-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-green-500" />
                    )}
                    <span className="text-slate-600 dark:text-slate-400">→ {formatCurrency(renewal.projectedValue)}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-2">
                <span className={cn("text-xs font-medium", recommendationColors[renewal.recommendation])}>
                  Recommendation: {renewal.recommendation.charAt(0).toUpperCase() + renewal.recommendation.slice(1)}
                </span>
              </div>
              
              {renewal.risks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {renewal.risks.slice(0, 2).map((risk, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {risk}
                    </span>
                  ))}
                  {renewal.risks.length > 2 && (
                    <span className="text-[10px] text-slate-500">+{renewal.risks.length - 2}</span>
                  )}
                </div>
              )}
              
              <Link 
                href={`/contracts/${renewal.contractId}`}
                className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                View Contract
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </>
          )}
        </div>
        
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(renewal.renewalDate).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>
          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
            {formatCurrency(renewal.currentValue)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RenewalsCalendar;

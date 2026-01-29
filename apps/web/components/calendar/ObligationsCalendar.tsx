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
  Activity,
  FileText,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Types
interface Obligation {
  id: string;
  title: string;
  description: string;
  type: string;
  dueDate: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'at_risk';
  owner?: string;
  contractId: string;
  contractTitle?: string;
  clauseReference?: string;
  completedAt?: string;
}

interface ObligationsCalendarProps {
  obligations: Obligation[];
  onStatusUpdate?: (id: string, status: string) => void;
  onComplete?: (id: string) => void;
}

// Priority colors
const priorityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const priorityBadgeColors = {
  critical: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  high: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
  low: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
};

// Status colors
const statusColors = {
  pending: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  in_progress: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  at_risk: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// Status icons
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'overdue':
      return <XCircle className="w-3.5 h-3.5" />;
    case 'at_risk':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'in_progress':
      return <Activity className="w-3.5 h-3.5" />;
    default:
      return <Clock className="w-3.5 h-3.5" />;
  }
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function ObligationsCalendar({ obligations, onStatusUpdate, onComplete }: ObligationsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Get calendar data
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();
    
    // Days in month
    const daysInMonth = lastDay.getDate();
    
    // Create calendar grid
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
    
    // Next month days to complete the grid (6 rows of 7)
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

  // Get obligations for a specific date
  const getObligationsForDate = useCallback((date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return obligations.filter(o => {
      const obligationDate = new Date(o.dueDate).toISOString().split('T')[0];
      return obligationDate === dateStr;
    });
  }, [obligations]);

  // Navigate months
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

  // Get obligations for selected date
  const selectedDateObligations = selectedDate ? getObligationsForDate(selectedDate) : [];

  // Get week view data
  const weekData = useMemo(() => {
    if (viewMode !== 'week') return [];
    
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  }, [currentDate, viewMode]);

  // Calculate stats for the month
  const monthStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthObligations = obligations.filter(o => {
      const date = new Date(o.dueDate);
      return date.getFullYear() === year && date.getMonth() === month;
    });
    
    return {
      total: monthObligations.length,
      completed: monthObligations.filter(o => o.status === 'completed').length,
      overdue: monthObligations.filter(o => o.status === 'overdue').length,
      critical: monthObligations.filter(o => o.priority === 'critical').length,
    };
  }, [obligations, currentDate]);

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
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
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-slate-600 dark:text-slate-400">{monthStats.total} Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-slate-600 dark:text-slate-400">{monthStats.completed} Done</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">{monthStats.overdue} Overdue</span>
            </div>
          </div>
          
          {/* View Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === 'month' 
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
              onClick={() => setViewMode('month')}
            >
              Month
            </button>
            <button
              className={cn(
                "px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === 'week'
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
              onClick={() => setViewMode('week')}
            >
              Week
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
                    const dayObligations = getObligationsForDate(day.date);
                    const hasObligations = dayObligations.length > 0;
                    const hasOverdue = dayObligations.some(o => o.status === 'overdue');
                    const hasCritical = dayObligations.some(o => o.priority === 'critical');
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
                                day.isToday && "ring-2 ring-violet-500 ring-offset-1",
                                isSelected && "border-violet-500 bg-violet-50 dark:bg-violet-900/20",
                                !isSelected && "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                              )}
                            >
                              <span className={cn(
                                "text-sm font-medium",
                                day.isToday && "text-violet-600 dark:text-violet-400"
                              )}>
                                {day.date.getDate()}
                              </span>
                              
                              {hasObligations && (
                                <div className="flex flex-wrap gap-0.5 mt-1 flex-1">
                                  {dayObligations.slice(0, 3).map((o, i) => (
                                    <div
                                      key={i}
                                      className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        priorityColors[o.priority]
                                      )}
                                    />
                                  ))}
                                  {dayObligations.length > 3 && (
                                    <span className="text-[10px] text-slate-500">+{dayObligations.length - 3}</span>
                                  )}
                                </div>
                              )}
                              
                              {(hasOverdue || hasCritical) && (
                                <div className="absolute top-1 right-1">
                                  <AlertTriangle className={cn(
                                    "w-3 h-3",
                                    hasOverdue ? "text-red-500" : "text-orange-500"
                                  )} />
                                </div>
                              )}
                            </button>
                          </TooltipTrigger>
                          {hasObligations && (
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="font-medium mb-1">{dayObligations.length} obligation{dayObligations.length > 1 ? 's' : ''}</p>
                              <ul className="text-xs space-y-1">
                                {dayObligations.slice(0, 3).map((o, i) => (
                                  <li key={i} className="flex items-center gap-1">
                                    <div className={cn("w-1.5 h-1.5 rounded-full", priorityColors[o.priority])} />
                                    <span className="truncate">{o.title}</span>
                                  </li>
                                ))}
                                {dayObligations.length > 3 && (
                                  <li className="text-slate-500">+{dayObligations.length - 3} more</li>
                                )}
                              </ul>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </>
            ) : (
              /* Week View */
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-2">
                  {weekData.map((date, index) => {
                    const dayObligations = getObligationsForDate(date);
                    const isToday = date.toDateString() === new Date().toDateString();
                    const isSelected = selectedDate?.toDateString() === date.toDateString();
                    
                    return (
                      <button
                        key={index}
                        onClick={() => setSelectedDate(date)}
                        className={cn(
                          "p-3 rounded-lg border transition-all text-center",
                          isToday && "ring-2 ring-violet-500",
                          isSelected 
                            ? "border-violet-500 bg-violet-50 dark:bg-violet-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-white dark:bg-slate-800"
                        )}
                      >
                        <div className="text-xs text-slate-500 dark:text-slate-400">{DAYS[date.getDay()]}</div>
                        <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{date.getDate()}</div>
                        {dayObligations.length > 0 && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {dayObligations.length}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Week obligations list */}
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                  {weekData.map((date, index) => {
                    const dayObligations = getObligationsForDate(date);
                    if (dayObligations.length === 0) return null;
                    
                    return (
                      <div key={index} className="space-y-2">
                        <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {DAYS[date.getDay()]}, {date.getDate()} {MONTHS[date.getMonth()]}
                        </h4>
                        {dayObligations.map(obligation => (
                          <ObligationCard 
                            key={obligation.id} 
                            obligation={obligation}
                            compact
                            onStatusUpdate={onStatusUpdate}
                            onComplete={onComplete}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected Date Details */}
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-violet-500" />
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
                {selectedDateObligations.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3 max-h-[400px] overflow-y-auto"
                  >
                    {selectedDateObligations.map(obligation => (
                      <ObligationCard 
                        key={obligation.id} 
                        obligation={obligation}
                        onStatusUpdate={onStatusUpdate}
                        onComplete={onComplete}
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
                    <p className="text-sm">No obligations on this date</p>
                  </motion.div>
                )}
              </AnimatePresence>
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <CalendarIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click on a date to see obligations</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200/50 dark:border-slate-700/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Priority:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-slate-600 dark:text-slate-400">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-slate-600 dark:text-slate-400">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <span className="text-slate-600 dark:text-slate-400">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-slate-600 dark:text-slate-400">Low</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Obligation Card Component
function ObligationCard({ 
  obligation, 
  compact = false,
  onStatusUpdate,
  onComplete 
}: { 
  obligation: Obligation; 
  compact?: boolean;
  onStatusUpdate?: (id: string, status: string) => void;
  onComplete?: (id: string) => void;
}) {
  return (
    <div className={cn(
      "p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 transition-all hover:shadow-sm",
      compact && "p-2"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant="outline" 
              className={cn("text-[10px] px-1.5 py-0", priorityBadgeColors[obligation.priority])}
            >
              {obligation.priority}
            </Badge>
            <Badge 
              variant="outline"
              className={cn("text-[10px] px-1.5 py-0 flex items-center gap-1", statusColors[obligation.status])}
            >
              <StatusIcon status={obligation.status} />
              {obligation.status.replace('_', ' ')}
            </Badge>
          </div>
          <h4 className={cn(
            "font-medium text-slate-900 dark:text-slate-100 truncate",
            compact ? "text-xs" : "text-sm"
          )}>
            {obligation.title}
          </h4>
          {!compact && obligation.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
              {obligation.description}
            </p>
          )}
          {obligation.contractTitle && (
            <Link 
              href={`/contracts/${obligation.contractId}`}
              className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline mt-1"
            >
              <FileText className="w-3 h-3" />
              {obligation.contractTitle}
              <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
        </div>
        
        {!compact && obligation.status !== 'completed' && onComplete && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Actions
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <div className="space-y-1">
                {obligation.status !== 'in_progress' && onStatusUpdate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => onStatusUpdate(obligation.id, 'in_progress')}
                  >
                    <Activity className="w-3.5 h-3.5 mr-2" />
                    Mark In Progress
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                  onClick={() => onComplete(obligation.id)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
                  Mark Complete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default ObligationsCalendar;

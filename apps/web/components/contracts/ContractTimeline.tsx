'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays, isAfter, isBefore, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import {
  CalendarDays,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Info,
  Calendar,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ContractEvent {
  id: string;
  contractId: string;
  contractTitle: string;
  type: 'start' | 'end' | 'renewal' | 'milestone' | 'payment' | 'review' | 'expiring';
  date: Date;
  description?: string;
  value?: number;
  status?: 'completed' | 'pending' | 'overdue' | 'upcoming';
}

export interface ContractPeriod {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'expiring' | 'expired' | 'pending' | 'draft';
  value?: number;
  supplierName?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  events: ContractEvent[];
}

// Alias for backward compatibility
export type TimelineContract = ContractPeriod;

interface ContractTimelineProps {
  contracts: ContractPeriod[];
  onContractClick?: (contractId: string) => void;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusColor = (status: ContractPeriod['status']) => {
  switch (status) {
    case 'active':
      return 'bg-gradient-to-r from-violet-500 to-violet-500';
    case 'expiring':
      return 'bg-gradient-to-r from-amber-500 to-orange-500';
    case 'expired':
      return 'bg-gradient-to-r from-red-500 to-rose-500';
    case 'pending':
      return 'bg-gradient-to-r from-violet-500 to-purple-500';
    case 'draft':
      return 'bg-gradient-to-r from-slate-400 to-slate-500';
    default:
      return 'bg-gradient-to-r from-slate-400 to-slate-500';
  }
};

const getRiskColor = (risk?: 'low' | 'medium' | 'high') => {
  switch (risk) {
    case 'high':
      return 'border-red-500';
    case 'medium':
      return 'border-amber-500';
    case 'low':
      return 'border-green-500';
    default:
      return 'border-transparent';
  }
};

const getEventIcon = (type: ContractEvent['type']) => {
  switch (type) {
    case 'start':
      return <Calendar className="w-3 h-3" />;
    case 'end':
      return <CheckCircle2 className="w-3 h-3" />;
    case 'renewal':
      return <Sparkles className="w-3 h-3" />;
    case 'milestone':
      return <FileText className="w-3 h-3" />;
    case 'payment':
      return <DollarSign className="w-3 h-3" />;
    case 'review':
      return <Clock className="w-3 h-3" />;
    case 'expiring':
      return <AlertTriangle className="w-3 h-3" />;
    default:
      return <Info className="w-3 h-3" />;
  }
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// ============================================================================
// Timeline Component
// ============================================================================

export function ContractTimeline({ contracts, onContractClick, className }: ContractTimelineProps) {
  const [viewMode, setViewMode] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [zoom, setZoom] = useState(1);

  // Calculate timeline range
  const timelineRange = useMemo(() => {
    const today = currentDate;
    let start: Date;
    let end: Date;

    switch (viewMode) {
      case 'month':
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
      case 'quarter':
        start = addDays(today, -45);
        end = addDays(today, 45);
        break;
      case 'year':
        start = addDays(today, -180);
        end = addDays(today, 180);
        break;
      default:
        start = addDays(today, -45);
        end = addDays(today, 45);
    }

    return { start, end, totalDays: differenceInDays(end, start) };
  }, [currentDate, viewMode]);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter(contract => {
      if (filterStatus !== 'all' && contract.status !== filterStatus) {
        return false;
      }
      // Show contracts that overlap with the timeline range
      return !(isAfter(contract.startDate, timelineRange.end) || isBefore(contract.endDate, timelineRange.start));
    });
  }, [contracts, filterStatus, timelineRange]);

  // Calculate position and width for a contract bar
  const getBarStyles = (contract: ContractPeriod) => {
    const startOffset = Math.max(0, differenceInDays(contract.startDate, timelineRange.start));
    const endOffset = Math.min(timelineRange.totalDays, differenceInDays(contract.endDate, timelineRange.start));
    
    const left = (startOffset / timelineRange.totalDays) * 100;
    const width = ((endOffset - startOffset) / timelineRange.totalDays) * 100;

    return {
      left: `${Math.max(0, left)}%`,
      width: `${Math.min(100 - left, Math.max(2, width))}%`,
    };
  };

  // Navigate timeline
  const navigate = (direction: 'prev' | 'next') => {
    const days = viewMode === 'month' ? 30 : viewMode === 'quarter' ? 90 : 180;
    setCurrentDate(prev => 
      direction === 'prev' ? addDays(prev, -days) : addDays(prev, days)
    );
  };

  // Generate timeline markers
  const timelineMarkers = useMemo(() => {
    const days = eachDayOfInterval({ start: timelineRange.start, end: timelineRange.end });
    const step = viewMode === 'month' ? 7 : viewMode === 'quarter' ? 15 : 30;
    return days.filter((_, idx) => idx % step === 0);
  }, [timelineRange, viewMode]);

  // Today marker position
  const todayPosition = useMemo(() => {
    const today = new Date();
    if (isBefore(today, timelineRange.start) || isAfter(today, timelineRange.end)) {
      return null;
    }
    const offset = differenceInDays(today, timelineRange.start);
    return (offset / timelineRange.totalDays) * 100;
  }, [timelineRange]);

  return (
    <TooltipProvider>
      <Card className={cn("overflow-hidden shadow-xl border-0 bg-white/90 backdrop-blur-sm", className)}>
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-slate-900 to-purple-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 backdrop-blur-sm rounded-xl">
                <CalendarDays className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-white">Contract Timeline</CardTitle>
                <p className="text-violet-200 text-sm mt-0.5">
                  {format(timelineRange.start, 'MMM d, yyyy')} - {format(timelineRange.end, 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-white text-xs px-2">{Math.round(zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                  className="text-white hover:bg-white/20 h-8 w-8 p-0"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>

              {/* View Mode */}
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-28 bg-white/10 border-white/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>

              {/* Filter */}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28 bg-white/10 border-white/20 text-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('prev')}
                  className="text-white hover:bg-white/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate(new Date())}
                  className="text-white hover:bg-white/20 text-sm px-3"
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('next')}
                  className="text-white hover:bg-white/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Timeline Header (Date Markers) */}
          <div className="relative h-10 bg-gradient-to-b from-slate-100 to-white border-b border-slate-200">
            {timelineMarkers.map((date, idx) => {
              const position = (differenceInDays(date, timelineRange.start) / timelineRange.totalDays) * 100;
              return (
                <div
                  key={idx}
                  className="absolute top-0 h-full flex flex-col items-center justify-center"
                  style={{ left: `${position}%` }}
                >
                  <span className="text-[10px] text-slate-500 font-medium">
                    {format(date, viewMode === 'month' ? 'd' : 'MMM d')}
                  </span>
                  <div className="w-px h-2 bg-slate-300" />
                </div>
              );
            })}
            
            {/* Today Marker */}
            {todayPosition !== null && (
              <div
                className="absolute top-0 h-full z-10"
                style={{ left: `${todayPosition}%` }}
              >
                <div className="w-0.5 h-full bg-violet-600" />
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-violet-600 text-white text-[9px] font-bold rounded">
                  TODAY
                </div>
              </div>
            )}
          </div>

          {/* Timeline Body */}
          <div 
            className="relative overflow-x-auto"
            style={{ transform: `scaleX(${zoom})`, transformOrigin: 'left' }}
          >
            {filteredContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No contracts in this period</h3>
                <p className="text-slate-500 text-sm">Try adjusting the timeline range or filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredContracts.map((contract, idx) => (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="relative h-16 hover:bg-slate-50/50 transition-colors group"
                    onClick={() => onContractClick?.(contract.id)}
                  >
                    {/* Contract Label */}
                    <div className="absolute left-0 top-0 h-full w-48 flex items-center px-4 bg-white z-10 border-r border-slate-100">
                      <div className="truncate">
                        <p className="font-medium text-slate-900 text-sm truncate group-hover:text-violet-600 transition-colors cursor-pointer">
                          {contract.title}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {contract.supplierName || 'No supplier'}
                        </p>
                      </div>
                    </div>

                    {/* Timeline Track */}
                    <div className="absolute left-48 right-0 top-0 h-full">
                      {/* Contract Bar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: idx * 0.05 + 0.2 }}
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 h-8 rounded-lg shadow-md cursor-pointer transition-all",
                              "hover:shadow-lg hover:scale-y-110",
                              getStatusColor(contract.status),
                              `border-l-4 ${getRiskColor(contract.riskLevel)}`
                            )}
                            style={getBarStyles(contract)}
                          >
                            {/* Event Markers */}
                            {contract.events?.map((event, eventIdx) => {
                              const eventPosition = differenceInDays(event.date, contract.startDate);
                              const contractDuration = differenceInDays(contract.endDate, contract.startDate);
                              const left = (eventPosition / contractDuration) * 100;
                              
                              if (left < 0 || left > 100) return null;
                              
                              return (
                                <Tooltip key={eventIdx}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md flex items-center justify-center text-slate-700 cursor-pointer hover:scale-125 transition-transform"
                                      style={{ left: `${left}%`, marginLeft: '-8px' }}
                                    >
                                      {getEventIcon(event.type)}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <p className="font-semibold capitalize">{event.type}</p>
                                      <p>{format(event.date, 'MMM d, yyyy')}</p>
                                      {event.description && <p className="text-slate-400">{event.description}</p>}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-1.5">
                            <p className="font-bold">{contract.title}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {contract.status}
                              </Badge>
                              {contract.riskLevel && (
                                <Badge variant="outline" className="capitalize text-[10px]">
                                  {contract.riskLevel} risk
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              {format(contract.startDate, 'MMM d, yyyy')} - {format(contract.endDate, 'MMM d, yyyy')}
                            </p>
                            {contract.value && (
                              <p className="text-xs font-semibold text-green-600">
                                {formatCurrency(contract.value)}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>

                      {/* Today line in track */}
                      {todayPosition !== null && (
                        <div
                          className="absolute top-0 h-full w-px bg-violet-600/30"
                          style={{ left: `${todayPosition}%` }}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-gradient-to-r from-violet-500 to-violet-500" />
              <span className="text-xs text-slate-600">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-gradient-to-r from-amber-500 to-orange-500" />
              <span className="text-xs text-slate-600">Expiring</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-gradient-to-r from-red-500 to-rose-500" />
              <span className="text-xs text-slate-600">Expired</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded bg-gradient-to-r from-violet-500 to-purple-500" />
              <span className="text-xs text-slate-600">Pending</span>
            </div>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-violet-600" />
              <span className="text-xs text-slate-600">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

export default ContractTimeline;

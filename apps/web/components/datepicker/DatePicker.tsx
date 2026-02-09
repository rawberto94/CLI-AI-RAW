'use client';

/**
 * Date Picker Component
 * Accessible date picker with calendar
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
  error?: string;
  label?: string;
}

interface DateRangePickerProps {
  startDate?: Date | null;
  endDate?: Date | null;
  onChange: (range: { start: Date | null; end: Date | null }) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Add days from previous month to fill first week
  const startPadding = firstDay.getDay();
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  
  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Add days from next month to fill last week
  const endPadding = 42 - days.length; // 6 weeks * 7 days
  for (let i = 1; i <= endPadding; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Calendar Component
// ============================================================================

interface CalendarViewProps {
  selectedDate?: Date | null;
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  isSelectingRange?: boolean;
}

function CalendarView({
  selectedDate,
  onSelect,
  minDate,
  maxDate,
  currentMonth,
  onMonthChange,
  rangeStart,
  rangeEnd,
  isSelectingRange,
}: CalendarViewProps) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const days = getDaysInMonth(year, month);
  const today = new Date();

  const goToPrevMonth = () => {
    onMonthChange(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    onMonthChange(new Date(year, month + 1, 1));
  };

  const isDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isInRange = (date: Date) => {
    if (!rangeStart || !rangeEnd) return false;
    return date >= rangeStart && date <= rangeEnd;
  };

  const isRangeStart = (date: Date) => {
    return rangeStart ? isSameDay(date, rangeStart) : false;
  };

  const isRangeEnd = (date: Date) => {
    return rangeEnd ? isSameDay(date, rangeEnd) : false;
  };

  return (
    <div className="p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <span className="font-medium text-slate-900">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((day) => (
          <div
            key={day}
            className="h-8 flex items-center justify-center text-xs font-medium text-slate-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {days.map((date, index) => {
          const isCurrentMonth = date.getMonth() === month;
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isToday = isSameDay(date, today);
          const disabled = isDisabled(date);
          const inRange = isInRange(date);
          const rangeStartDay = isRangeStart(date);
          const rangeEndDay = isRangeEnd(date);

          return (
            <button
              key={index}
              onClick={() => !disabled && onSelect(date)}
              disabled={disabled}
              className={cn(
                'h-9 flex items-center justify-center text-sm transition-colors relative',
                !isCurrentMonth && 'text-slate-300',
                isCurrentMonth && !isSelected && !inRange && 'text-slate-700 hover:bg-slate-100',
                isToday && !isSelected && 'font-bold text-violet-600',
                disabled && 'opacity-30 cursor-not-allowed',
                inRange && !rangeStartDay && !rangeEndDay && 'bg-violet-100',
                (rangeStartDay || rangeEndDay) && 'bg-violet-600 text-white rounded-lg',
                isSelected && !isSelectingRange && 'bg-violet-600 text-white rounded-lg'
              )}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Date Picker
// ============================================================================

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minDate,
  maxDate,
  disabled = false,
  className,
  error,
  label,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 border rounded-xl text-left transition-all',
          error
            ? 'border-red-300 focus:ring-red-500'
            : 'border-slate-200 hover:border-slate-300 focus:ring-violet-500',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-50'
        )}
      >
        <Calendar className="w-5 h-5 text-slate-400" />
        <span className={cn('flex-1', !value && 'text-slate-400')}>
          {value ? formatDate(value) : placeholder}
        </span>
        {value && !disabled && (
          <button
            onClick={handleClear}
            className="p-1 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </button>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl"
          >
            <CalendarView
              selectedDate={value}
              onSelect={handleSelect}
              minDate={minDate}
              maxDate={maxDate}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Date Range Picker
// ============================================================================

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = 'Select date range',
  minDate,
  maxDate,
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startDate || new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleSelect = (date: Date) => {
    if (selectingStart) {
      onChange({ start: date, end: null });
      setSelectingStart(false);
    } else {
      if (date < (startDate || new Date())) {
        onChange({ start: date, end: startDate ?? null });
      } else {
        onChange({ start: startDate ?? null, end: date });
      }
      setSelectingStart(true);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ start: null, end: null });
    setSelectingStart(true);
  };

  const displayValue = () => {
    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }
    if (startDate) {
      return `${formatDate(startDate)} - ...`;
    }
    return placeholder;
  };

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 border border-slate-200 rounded-xl text-left hover:border-slate-300 transition-all',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-50'
        )}
      >
        <Calendar className="w-5 h-5 text-slate-400" />
        <span className={cn('flex-1', !startDate && !endDate && 'text-slate-400')}>
          {displayValue()}
        </span>
        {(startDate || endDate) && !disabled && (
          <button
            onClick={handleClear}
            className="p-1 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl"
          >
            <div className="px-4 py-2 border-b border-slate-100">
              <p className="text-xs text-slate-500">
                {selectingStart ? 'Select start date' : 'Select end date'}
              </p>
            </div>
            <CalendarView
              onSelect={handleSelect}
              minDate={minDate}
              maxDate={maxDate}
              currentMonth={currentMonth}
              onMonthChange={setCurrentMonth}
              rangeStart={startDate}
              rangeEnd={endDate}
              isSelectingRange
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

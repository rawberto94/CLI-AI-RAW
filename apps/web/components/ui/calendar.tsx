/**
 * Calendar Component
 * Full-featured date picker with range selection support
 */

'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | { from?: Date; to?: Date } | undefined;
  onSelect?: (date: Date | Date[] | { from?: Date; to?: Date } | undefined) => void;
  className?: string;
  initialFocus?: boolean;
  disabled?: boolean | ((date: Date) => boolean);
  defaultMonth?: Date;
  numberOfMonths?: number;
  fromDate?: Date;
  toDate?: Date;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isInRange(date: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  return date >= from && date <= to;
}

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  className,
  disabled,
  defaultMonth,
  numberOfMonths = 1,
  fromDate,
  toDate,
}: CalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = React.useState(
    defaultMonth?.getMonth() ?? today.getMonth()
  );
  const [currentYear, setCurrentYear] = React.useState(
    defaultMonth?.getFullYear() ?? today.getFullYear()
  );
  const [rangeStart, setRangeStart] = React.useState<Date | undefined>(
    mode === 'range' && selected && typeof selected === 'object' && 'from' in selected
      ? selected.from
      : undefined
  );

  const goToPreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isDateDisabled = (date: Date): boolean => {
    if (typeof disabled === 'function') {
      return disabled(date);
    }
    if (disabled) return true;
    if (fromDate && date < fromDate) return true;
    if (toDate && date > toDate) return true;
    return false;
  };

  const isDateSelected = (date: Date): boolean => {
    if (!selected) return false;
    
    if (mode === 'single' && selected instanceof Date) {
      return isSameDay(date, selected);
    }
    
    if (mode === 'multiple' && Array.isArray(selected)) {
      return selected.some(d => isSameDay(date, d));
    }
    
    if (mode === 'range' && typeof selected === 'object' && 'from' in selected) {
      const { from, to } = selected;
      if (from && isSameDay(date, from)) return true;
      if (to && isSameDay(date, to)) return true;
    }
    
    return false;
  };

  const isInSelectedRange = (date: Date): boolean => {
    if (mode !== 'range' || !selected || typeof selected !== 'object' || !('from' in selected)) {
      return false;
    }
    return isInRange(date, selected.from, selected.to);
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'multiple') {
      const currentSelected = Array.isArray(selected) ? selected : [];
      const isAlreadySelected = currentSelected.some(d => isSameDay(date, d));
      if (isAlreadySelected) {
        onSelect?.(currentSelected.filter(d => !isSameDay(date, d)));
      } else {
        onSelect?.([...currentSelected, date]);
      }
    } else if (mode === 'range') {
      if (!rangeStart) {
        setRangeStart(date);
        onSelect?.({ from: date, to: undefined });
      } else {
        if (date < rangeStart) {
          onSelect?.({ from: date, to: rangeStart });
        } else {
          onSelect?.({ from: rangeStart, to: date });
        }
        setRangeStart(undefined);
      }
    }
  };

  const renderMonth = (monthOffset: number = 0) => {
    let month = currentMonth + monthOffset;
    let year = currentYear;
    if (month > 11) {
      month = month - 12;
      year = year + 1;
    }

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return (
      <div key={`${year}-${month}`} className="p-3">
        {/* Month/Year header - only show on first month */}
        {monthOffset === 0 && (
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-semibold text-sm">
              {MONTHS[month]} {year}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        {monthOffset > 0 && (
          <div className="text-center font-semibold text-sm mb-4">
            {MONTHS[month]} {year}
          </div>
        )}

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map(day => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs font-medium text-slate-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-8" />;
            }

            const isToday = isSameDay(date, today);
            const isSelected = isDateSelected(date);
            const isDisabled = isDateDisabled(date);
            const inRange = isInSelectedRange(date);

            return (
              <button
                key={date.toISOString()}
                onClick={() => handleDateClick(date)}
                disabled={isDisabled}
                className={cn(
                  "h-8 w-8 rounded-md text-sm transition-colors flex items-center justify-center",
                  "hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1",
                  isToday && !isSelected && "border border-blue-500 text-blue-600",
                  isSelected && "bg-blue-600 text-white hover:bg-blue-700",
                  inRange && !isSelected && "bg-blue-100 text-blue-900",
                  isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("bg-white rounded-lg border shadow-lg", className)}>
      <div className={cn("flex", numberOfMonths > 1 && "divide-x")}>
        {Array.from({ length: numberOfMonths }).map((_, i) => renderMonth(i))}
      </div>
    </div>
  );
}

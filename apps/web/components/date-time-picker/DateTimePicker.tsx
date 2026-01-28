'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, 
  ChevronUp, ChevronDown, X
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DateRange {
  start: Date | null;
  end: Date | null;
}

// ============================================================================
// Helpers
// ============================================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.toDateString() === b.toDateString();
}

function isInRange(date: Date, range: DateRange): boolean {
  if (!range.start || !range.end) return false;
  return date >= range.start && date <= range.end;
}

function formatDate(date: Date | null, format: string = 'MMM dd, yyyy'): string {
  if (!date) return '';
  
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  
  return format
    .replace('yyyy', year.toString())
    .replace('yy', year.toString().slice(-2))
    .replace('MMMM', MONTHS[month])
    .replace('MMM', MONTHS[month].slice(0, 3))
    .replace('MM', (month + 1).toString().padStart(2, '0'))
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('d', day.toString());
}

// ============================================================================
// Calendar
// ============================================================================

interface CalendarProps {
  value?: Date | null;
  onChange?: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  highlightedDates?: Date[];
  disabledDates?: Date[];
  showWeekNumbers?: boolean;
  className?: string;
}

export function CalendarPicker({
  value,
  onChange,
  minDate,
  maxDate,
  highlightedDates = [],
  disabledDates = [],
  showWeekNumbers = false,
  className = '',
}: CalendarProps) {
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));

  const isDisabled = (date: Date): boolean => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return disabledDates.some(d => isSameDay(d, date));
  };

  const isHighlighted = (date: Date): boolean => {
    return highlightedDates.some(d => isSameDay(d, date));
  };

  const days = useMemo(() => {
    const result: (Date | null)[] = [];
    
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      result.push(null);
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      result.push(new Date(year, month, i));
    }
    
    return result;
  }, [year, month, daysInMonth, firstDay]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 w-80 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={() => setViewMode(viewMode === 'days' ? 'months' : 'days')}
          className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-semibold text-gray-900 dark:text-white"
        >
          {MONTHS[month]} {year}
        </button>
        
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Days of week */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS.map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, i) => (
          <div key={i} className="aspect-square">
            {date && (
              <button
                onClick={() => !isDisabled(date) && onChange?.(date)}
                disabled={isDisabled(date)}
                className={`
                  w-full h-full flex items-center justify-center text-sm rounded-lg transition-colors
                  ${isSameDay(date, value || null)
                    ? 'bg-violet-600 text-white'
                    : isSameDay(date, new Date())
                    ? 'bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400'
                    : isHighlighted(date)
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                    : isDisabled(date)
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  }
                `}
              >
                {date.getDate()}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Today button */}
      <button
        onClick={() => {
          const today = new Date();
          setViewDate(today);
          onChange?.(today);
        }}
        className="w-full mt-4 py-2 text-sm text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950 rounded-lg transition-colors"
      >
        Today
      </button>
    </div>
  );
}

// ============================================================================
// Date Range Picker
// ============================================================================

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DateRangePicker({
  value = { start: null, end: null },
  onChange,
  minDate,
  maxDate,
  className = '',
}: DateRangePickerProps) {
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [viewDate, setViewDate] = useState(() => value.start || new Date());
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const handleDateClick = (date: Date) => {
    if (selecting === 'start') {
      onChange?.({ start: date, end: null });
      setSelecting('end');
    } else {
      if (value.start && date < value.start) {
        onChange?.({ start: date, end: value.start });
      } else {
        onChange?.({ ...value, end: date });
      }
      setSelecting('start');
    }
  };

  const previewRange: DateRange = {
    start: value.start,
    end: selecting === 'end' && value.start && hoverDate ? hoverDate : value.end,
  };

  const renderMonth = (monthOffset: number) => {
    const viewYear = monthOffset === 0 ? year : month === 11 ? year + 1 : year;
    const viewMonth = (month + monthOffset) % 12;
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(viewYear, viewMonth, i));
    }

    return (
      <div>
        <div className="text-center font-semibold text-gray-900 dark:text-white mb-4">
          {MONTHS[viewMonth]} {viewYear}
        </div>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
              {day[0]}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, i) => {
            const isStart = date && isSameDay(date, value.start);
            const isEnd = date && isSameDay(date, previewRange.end);
            const inRange = date && previewRange.start && previewRange.end && 
              isInRange(date, previewRange);

            return (
              <div key={i} className="aspect-square">
                {date && (
                  <button
                    onClick={() => handleDateClick(date)}
                    onMouseEnter={() => setHoverDate(date)}
                    onMouseLeave={() => setHoverDate(null)}
                    className={`
                      w-full h-full flex items-center justify-center text-sm transition-colors
                      ${isStart || isEnd
                        ? 'bg-violet-600 text-white rounded-lg'
                        : inRange
                        ? 'bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg'
                      }
                      ${isStart ? 'rounded-r-none' : ''}
                      ${isEnd ? 'rounded-l-none' : ''}
                    `}
                  >
                    {date.getDate()}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-8">
        {renderMonth(0)}
        {renderMonth(1)}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {value.start ? formatDate(value.start) : 'Start date'}
          {' – '}
          {value.end ? formatDate(value.end) : 'End date'}
        </div>
        <button
          onClick={() => onChange?.({ start: null, end: null })}
          className="text-sm text-violet-600 hover:underline"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Time Picker
// ============================================================================

interface TimePickerProps {
  value?: string;
  onChange?: (time: string) => void;
  format?: '12h' | '24h';
  minuteStep?: number;
  className?: string;
}

export function TimePicker({
  value = '12:00',
  onChange,
  format = '12h',
  minuteStep = 5,
  className = '',
}: TimePickerProps) {
  const [hours, minutes] = value.split(':').map(Number);
  const [period, setPeriod] = useState<'AM' | 'PM'>(hours >= 12 ? 'PM' : 'AM');

  const displayHour = format === '12h' 
    ? hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    : hours;

  const updateTime = (h: number, m: number) => {
    const finalHour = format === '12h'
      ? period === 'PM' ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h)
      : h;
    onChange?.(`${finalHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  };

  const incrementHour = () => {
    const maxHour = format === '12h' ? 12 : 23;
    const newHour = displayHour >= maxHour ? (format === '12h' ? 1 : 0) : displayHour + 1;
    updateTime(newHour, minutes);
  };

  const decrementHour = () => {
    const minHour = format === '12h' ? 1 : 0;
    const maxHour = format === '12h' ? 12 : 23;
    const newHour = displayHour <= minHour ? maxHour : displayHour - 1;
    updateTime(newHour, minutes);
  };

  const incrementMinute = () => {
    const newMinute = (minutes + minuteStep) % 60;
    updateTime(displayHour, newMinute);
  };

  const decrementMinute = () => {
    const newMinute = minutes - minuteStep < 0 ? 60 - minuteStep : minutes - minuteStep;
    updateTime(displayHour, newMinute);
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    const newHour = newPeriod === 'PM'
      ? (displayHour === 12 ? 12 : displayHour + 12)
      : (displayHour === 12 ? 0 : displayHour);
    onChange?.(`${newHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  };

  return (
    <div className={`inline-flex items-center gap-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex flex-col items-center">
        <button onClick={incrementHour} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ChevronUp className="w-5 h-5" />
        </button>
        <span className="text-2xl font-bold text-gray-900 dark:text-white w-12 text-center">
          {displayHour.toString().padStart(2, '0')}
        </span>
        <button onClick={decrementHour} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
      
      <span className="text-2xl font-bold text-gray-400">:</span>
      
      <div className="flex flex-col items-center">
        <button onClick={incrementMinute} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ChevronUp className="w-5 h-5" />
        </button>
        <span className="text-2xl font-bold text-gray-900 dark:text-white w-12 text-center">
          {minutes.toString().padStart(2, '0')}
        </span>
        <button onClick={decrementMinute} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {format === '12h' && (
        <button
          onClick={togglePeriod}
          className="ml-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-semibold text-gray-900 dark:text-white transition-colors"
        >
          {period}
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Date Input
// ============================================================================

interface DateInputProps {
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  format?: string;
  className?: string;
}

export function DateInput({
  value,
  onChange,
  placeholder = 'Select date',
  format = 'MMM dd, yyyy',
  className = '',
}: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
      >
        <Calendar className="w-5 h-5 text-gray-400" />
        <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
          {value ? formatDate(value, format) : placeholder}
        </span>
        {value && (
          <button
            onClick={e => {
              e.stopPropagation();
              onChange?.(null);
            }}
            className="ml-auto p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 z-50"
          >
            <CalendarPicker
              value={value}
              onChange={date => {
                onChange?.(date);
                setIsOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Time Input
// ============================================================================

interface TimeInputProps {
  value?: string;
  onChange?: (time: string) => void;
  placeholder?: string;
  format?: '12h' | '24h';
  className?: string;
}

export function TimeInput({
  value = '',
  onChange,
  placeholder = 'Select time',
  format = '12h',
  className = '',
}: TimeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (time: string): string => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    if (format === '12h') {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
      >
        <Clock className="w-5 h-5 text-gray-400" />
        <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
          {value ? formatTime(value) : placeholder}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-2 z-50"
          >
            <TimePicker
              value={value || '12:00'}
              onChange={time => onChange?.(time)}
              format={format}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

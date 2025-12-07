/**
 * Calendar Component Stub
 */

import React from 'react';

export interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[] | { from?: Date; to?: Date } | any;
  onSelect?: (date: Date | Date[] | { from?: Date; to?: Date } | undefined) => void;
  className?: string;
  initialFocus?: boolean;
  disabled?: boolean | ((date: Date) => boolean);
  defaultMonth?: Date;
  numberOfMonths?: number;
}

export function Calendar({ mode = 'single', selected, onSelect, className }: CalendarProps) {
  return (
    <div className={className}>
      <input 
        type="date" 
        onChange={(e) => onSelect?.(new Date(e.target.value))}
        className="w-full p-2 border rounded"
      />
    </div>
  );
}

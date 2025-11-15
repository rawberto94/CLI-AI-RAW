/**
 * Calendar Component Stub
 */

import React from 'react';

export interface CalendarProps {
  mode?: 'single' | 'multiple' | 'range';
  selected?: Date | Date[];
  onSelect?: (date: Date | Date[] | undefined) => void;
  className?: string;
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

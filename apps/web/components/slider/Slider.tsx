'use client';

/**
 * Slider & Range Input Components
 * Customizable sliders with range support
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'blue';
  size?: 'sm' | 'md' | 'lg';
}

interface RangeSliderProps {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'blue';
}

// ============================================================================
// Utilities
// ============================================================================

const colorClasses = {
  indigo: 'bg-purple-600',
  emerald: 'bg-violet-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
  blue: 'bg-violet-600',
};

const thumbColorClasses = {
  indigo: 'border-purple-600 focus:ring-purple-500',
  emerald: 'border-violet-600 focus:ring-violet-500',
  amber: 'border-amber-500 focus:ring-amber-500',
  red: 'border-red-600 focus:ring-red-500',
  blue: 'border-violet-600 focus:ring-violet-500',
};

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const thumbSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// ============================================================================
// Slider Component
// ============================================================================

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue = (v) => v.toString(),
  disabled = false,
  className,
  color = 'indigo',
  size = 'md',
}: SliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const percentage = ((value - min) / (max - min)) * 100;

  const handleTrackClick = (e: React.MouseEvent) => {
    if (disabled || !trackRef.current) return;
    
    const rect = trackRef.current.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    const newValue = Math.round((min + percentage * (max - min)) / step) * step;
    onChange(Math.min(max, Math.max(min, newValue)));
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      setIsDragging(true);

      const handleMouseMove = (e: MouseEvent) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const newValue = Math.round((min + percentage * (max - min)) / step) * step;
        onChange(Math.min(max, Math.max(min, newValue)));
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [disabled, min, max, step, onChange]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-slate-700">{label}</label>
          )}
          {showValue && (
            <span className="text-sm font-medium text-slate-900">
              {formatValue(value)}
            </span>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className={cn(
          'relative rounded-full bg-slate-200 cursor-pointer',
          sizeClasses[size],
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Filled track */}
        <motion.div
          className={cn('absolute left-0 top-0 h-full rounded-full', colorClasses[color])}
          style={{ width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />

        {/* Thumb */}
        <motion.div
          onMouseDown={handleMouseDown}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full border-2 shadow-sm cursor-grab focus:outline-none focus:ring-2 focus:ring-offset-2',
            thumbSizes[size],
            thumbColorClasses[color],
            isDragging && 'cursor-grabbing scale-110',
            disabled && 'cursor-not-allowed'
          )}
          style={{ left: `${percentage}%` }}
          animate={{ left: `${percentage}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          whileTap={{ scale: 1.2 }}
        />
      </div>

      {/* Marks */}
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Range Slider Component
// ============================================================================

export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValues = true,
  formatValue = (v) => v.toString(),
  disabled = false,
  className,
  color = 'indigo',
}: RangeSliderProps) {
  const [activeThumb, setActiveThumb] = useState<'start' | 'end' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const startPercentage = ((value[0] - min) / (max - min)) * 100;
  const endPercentage = ((value[1] - min) / (max - min)) * 100;

  const handleMouseDown = useCallback(
    (thumb: 'start' | 'end') => (e: React.MouseEvent) => {
      if (disabled) return;
      setActiveThumb(thumb);

      const handleMouseMove = (e: MouseEvent) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const newValue = Math.round((min + percentage * (max - min)) / step) * step;
        const clampedValue = Math.min(max, Math.max(min, newValue));

        if (thumb === 'start') {
          onChange([Math.min(clampedValue, value[1] - step), value[1]]);
        } else {
          onChange([value[0], Math.max(clampedValue, value[0] + step)]);
        }
      };

      const handleMouseUp = () => {
        setActiveThumb(null);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [disabled, min, max, step, value, onChange]
  );

  return (
    <div className={cn('space-y-2', className)}>
      {(label || showValues) && (
        <div className="flex items-center justify-between">
          {label && (
            <label className="text-sm font-medium text-slate-700">{label}</label>
          )}
          {showValues && (
            <span className="text-sm font-medium text-slate-900">
              {formatValue(value[0])} - {formatValue(value[1])}
            </span>
          )}
        </div>
      )}

      <div
        ref={trackRef}
        className={cn(
          'relative h-2 rounded-full bg-slate-200',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Filled track */}
        <div
          className={cn('absolute top-0 h-full rounded-full', colorClasses[color])}
          style={{
            left: `${startPercentage}%`,
            width: `${endPercentage - startPercentage}%`,
          }}
        />

        {/* Start thumb */}
        <motion.div
          onMouseDown={handleMouseDown('start')}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-2 shadow-sm cursor-grab',
            thumbColorClasses[color],
            activeThumb === 'start' && 'cursor-grabbing scale-110 z-10',
            disabled && 'cursor-not-allowed'
          )}
          style={{ left: `${startPercentage}%` }}
          whileTap={{ scale: 1.2 }}
        />

        {/* End thumb */}
        <motion.div
          onMouseDown={handleMouseDown('end')}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 bg-white rounded-full border-2 shadow-sm cursor-grab',
            thumbColorClasses[color],
            activeThumb === 'end' && 'cursor-grabbing scale-110 z-10',
            disabled && 'cursor-not-allowed'
          )}
          style={{ left: `${endPercentage}%` }}
          whileTap={{ scale: 1.2 }}
        />
      </div>

      {/* Marks */}
      <div className="flex justify-between text-xs text-slate-400">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Stepped Slider with Labels
// ============================================================================

interface SteppedSliderProps {
  value: number;
  onChange: (value: number) => void;
  steps: { value: number; label: string }[];
  label?: string;
  disabled?: boolean;
  className?: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'red' | 'blue';
}

export function SteppedSlider({
  value,
  onChange,
  steps,
  label,
  disabled = false,
  className,
  color = 'indigo',
}: SteppedSliderProps) {
  const currentIndex = steps.findIndex((s) => s.value === value);
  const percentage = (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className={cn('space-y-4', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-700">{label}</label>
      )}

      <div className="relative">
        {/* Track */}
        <div className="h-2 rounded-full bg-slate-200">
          <motion.div
            className={cn('h-full rounded-full', colorClasses[color])}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        </div>

        {/* Steps */}
        <div className="absolute top-0 left-0 right-0 flex justify-between">
          {steps.map((step, index) => {
            const isActive = index <= currentIndex;
            const stepPercentage = (index / (steps.length - 1)) * 100;

            return (
              <button
                key={step.value}
                onClick={() => !disabled && onChange(step.value)}
                disabled={disabled}
                className="relative -translate-x-1/2"
                style={{ left: `${stepPercentage}%`, position: 'absolute' }}
              >
                <motion.div
                  className={cn(
                    'w-4 h-4 rounded-full border-2 bg-white transition-colors',
                    isActive ? thumbColorClasses[color] : 'border-slate-300'
                  )}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Labels */}
      <div className="relative h-6">
        {steps.map((step, index) => {
          const stepPercentage = (index / (steps.length - 1)) * 100;

          return (
            <span
              key={step.value}
              className={cn(
                'absolute text-xs transform -translate-x-1/2',
                value === step.value ? 'text-slate-900 font-medium' : 'text-slate-400'
              )}
              style={{ left: `${stepPercentage}%` }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

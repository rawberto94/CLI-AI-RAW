'use client';

/**
 * Rating Component
 * Star ratings with half-star support
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Heart, ThumbsUp, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  readonly?: boolean;
  allowHalf?: boolean;
  icon?: 'star' | 'heart' | 'thumbs';
  color?: string;
  emptyColor?: string;
  showValue?: boolean;
  className?: string;
}

// ============================================================================
// Utilities
// ============================================================================

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

const gapClasses = {
  sm: 'gap-0.5',
  md: 'gap-1',
  lg: 'gap-1.5',
  xl: 'gap-2',
};

const icons: Record<string, LucideIcon> = {
  star: Star,
  heart: Heart,
  thumbs: ThumbsUp,
};

// ============================================================================
// Rating Component
// ============================================================================

export function Rating({
  value,
  onChange,
  max = 5,
  size = 'md',
  readonly = false,
  allowHalf = false,
  icon = 'star',
  color = 'text-amber-400',
  emptyColor = 'text-slate-200',
  showValue = false,
  className,
}: RatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const Icon = icons[icon] ?? Star; // Default to Star if icon not found

  const displayValue = hoverValue !== null ? hoverValue : value;

  const handleClick = (index: number, isHalf: boolean) => {
    if (readonly || !onChange) return;
    const newValue = isHalf && allowHalf ? index + 0.5 : index + 1;
    onChange(newValue);
  };

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (readonly) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const isHalf = (e.clientX - rect.left) < rect.width / 2;
    
    if (allowHalf && isHalf) {
      setHoverValue(index + 0.5);
    } else {
      setHoverValue(index + 1);
    }
  };

  return (
    <div className={cn('flex items-center', gapClasses[size], className)}>
      {Array.from({ length: max }, (_, index) => {
        const isFilled = index + 1 <= displayValue;
        const isHalfFilled = index + 0.5 === displayValue;

        return (
          <motion.button
            key={index}
            type="button"
            onMouseMove={(e) => handleMouseMove(e, index)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const isHalf = (e.clientX - rect.left) < rect.width / 2;
              handleClick(index, isHalf);
            }}
            disabled={readonly}
            whileHover={!readonly ? { scale: 1.2 } : undefined}
            whileTap={!readonly ? { scale: 0.9 } : undefined}
            className={cn(
              'relative focus:outline-none',
              !readonly && 'cursor-pointer'
            )}
          >
            {/* Empty icon */}
            <Icon className={cn(sizeClasses[size], emptyColor)} />

            {/* Filled icon (full or half) */}
            {(isFilled || isHalfFilled) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: isHalfFilled ? '50%' : '100%' }}
              >
                <Icon className={cn(sizeClasses[size], color, 'fill-current')} />
              </div>
            )}
          </motion.button>
        );
      })}

      {showValue && (
        <span className="ml-2 text-sm font-medium text-violet-600 dark:text-violet-400">
          {value.toFixed(allowHalf ? 1 : 0)}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Rating Display (readonly with count)
// ============================================================================

interface RatingDisplayProps {
  value: number;
  count?: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RatingDisplay({
  value,
  count,
  max = 5,
  size = 'md',
  className,
}: RatingDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Rating value={value} max={max} size={size} readonly />
      <div className="flex items-center gap-1 text-sm text-slate-600">
        <span className="font-medium">{value.toFixed(1)}</span>
        {count !== undefined && (
          <span className="text-slate-400">({count.toLocaleString()})</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Rating Breakdown
// ============================================================================

interface RatingBreakdownProps {
  ratings: { stars: number; count: number }[];
  totalCount: number;
  className?: string;
}

export function RatingBreakdown({
  ratings,
  totalCount,
  className,
}: RatingBreakdownProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {ratings
        .sort((a, b) => b.stars - a.stars)
        .map(({ stars, count }) => {
          const percentage = totalCount > 0 ? (count / totalCount) * 100 : 0;

          return (
            <div key={stars} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-12 text-sm text-slate-600">
                <span>{stars}</span>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-current" />
              </div>
              
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-amber-400 rounded-full"
                />
              </div>
              
              <span className="w-12 text-sm text-slate-500 text-right">
                {count.toLocaleString()}
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ============================================================================
// Emoji Rating
// ============================================================================

interface EmojiRatingProps {
  value: number | null;
  onChange: (value: number) => void;
  className?: string;
}

const emojis = [
  { value: 1, emoji: '😞', label: 'Very Bad' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '😊', label: 'Good' },
  { value: 5, emoji: '😍', label: 'Excellent' },
];

export function EmojiRating({ value, onChange, className }: EmojiRatingProps) {
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {emojis.map((item) => {
        const isSelected = value === item.value;
        const isHovered = hoveredValue === item.value;

        return (
          <motion.button
            key={item.value}
            onClick={() => onChange(item.value)}
            onMouseEnter={() => setHoveredValue(item.value)}
            onMouseLeave={() => setHoveredValue(null)}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-1 focus:outline-none"
          >
            <span
              className={cn(
                'text-3xl transition-all',
                isSelected ? 'grayscale-0' : 'grayscale opacity-50',
                (isHovered || isSelected) && 'grayscale-0 opacity-100'
              )}
            >
              {item.emoji}
            </span>
            <span
              className={cn(
                'text-xs transition-colors',
                isSelected ? 'text-slate-900 font-medium' : 'text-slate-400'
              )}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ============================================================================
// NPS Score (0-10 scale)
// ============================================================================

interface NPSScoreProps {
  value: number | null;
  onChange: (value: number) => void;
  className?: string;
}

export function NPSScore({ value, onChange, className }: NPSScoreProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex gap-1">
        {Array.from({ length: 11 }, (_, i) => {
          const isSelected = value === i;
          const colorClass =
            i <= 6
              ? 'bg-red-100 hover:bg-red-200 text-red-700'
              : i <= 8
              ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
              : 'bg-violet-100 hover:bg-violet-200 text-violet-700';

          return (
            <motion.button
              key={i}
              onClick={() => onChange(i)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'w-10 h-10 rounded-lg text-sm font-medium transition-all',
                isSelected
                  ? 'ring-2 ring-offset-2 ring-purple-500'
                  : '',
                colorClass
              )}
            >
              {i}
            </motion.button>
          );
        })}
      </div>
      <div className="flex justify-between text-sm text-slate-500">
        <span>Not likely at all</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

/**
 * Success Checkmark Component
 * Animated checkmark for success states
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface SuccessCheckmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'green' | 'blue' | 'purple';
  showBackground?: boolean;
  delay?: number;
  onComplete?: () => void;
  className?: string;
}

export function SuccessCheckmark({
  size = 'md',
  color = 'green',
  showBackground = true,
  delay = 0,
  onComplete,
  className = '',
}: SuccessCheckmarkProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const colorClasses = {
    green: {
      text: 'text-green-600',
      bg: 'bg-green-100',
      border: 'border-green-200',
    },
    blue: {
      text: 'text-violet-600',
      bg: 'bg-violet-100',
      border: 'border-violet-200',
    },
    purple: {
      text: 'text-purple-600',
      bg: 'bg-purple-100',
      border: 'border-purple-200',
    },
  };

  const colors = colorClasses[color];

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        delay,
        duration: 0.3,
        ease: [0.68, -0.55, 0.265, 1.55],
      }}
      onAnimationComplete={onComplete}
      className={`
        ${sizeClasses[size]} 
        ${showBackground ? `${colors.bg} ${colors.border} border-2 rounded-full` : ''}
        flex items-center justify-center
        ${className}
      `}
    >
      <svg
        className={`${showBackground ? 'w-1/2 h-1/2' : 'w-full h-full'} ${colors.text}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            delay: delay + 0.2,
            duration: 0.5,
            ease: 'easeOut',
          }}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
        />
      </svg>
    </motion.div>
  );
}

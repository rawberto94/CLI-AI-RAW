/**
 * Count Up Component
 * Animated number counter
 */

'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface CountUpProps {
  from?: number;
  to: number;
  duration?: number; // seconds
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  className?: string;
  onComplete?: () => void;
}

export function CountUp({
  from = 0,
  to,
  duration = 2,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  separator = ',',
  className = '',
  onComplete,
}: CountUpProps) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    const timer = setTimeout(() => {
      animateCount();
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [from, to, duration, delay]);

  const animateCount = () => {
    const startTime = Date.now();
    const startValue = from;
    const endValue = to;
    const totalDuration = duration * 1000;

    const updateCount = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(endValue);
        onComplete?.();
      }
    };

    requestAnimationFrame(updateCount);
  };

  const formatNumber = (num: number) => {
    const rounded = Number(num.toFixed(decimals));
    const parts = rounded.toString().split('.');
    
    if (separator && parts[0]) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    }
    
    return parts.join('.');
  };

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={`font-mono ${className}`}
    >
      {prefix}{formatNumber(count)}{suffix}
    </motion.span>
  );
}

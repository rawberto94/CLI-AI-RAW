/**
 * Skeleton Loader Component
 * Animated placeholder for loading content
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  className = '',
  rounded = true,
}: SkeletonProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity }}
      className={`bg-gray-300 ${rounded ? 'rounded' : ''} ${className}`}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
    />
  );
}

export function SkeletonLoader() {
  return (
    <div className="space-y-3">
      <Skeleton width="60%" height="1.5rem" />
      <Skeleton width="100%" height="1rem" />
      <Skeleton width="80%" height="1rem" />
      <Skeleton width="90%" height="1rem" />
    </div>
  );
}

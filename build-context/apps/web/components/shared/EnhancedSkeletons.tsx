'use client';

/**
 * Enhanced Loading Skeletons
 * Beautiful, animated skeleton loaders for various content types
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ============================================================================
// Base Skeleton Components
// ============================================================================

interface SkeletonProps {
  className?: string;
  variant?: 'pulse' | 'wave' | 'shimmer';
  style?: React.CSSProperties;
}

export function Skeleton({ className, variant = 'shimmer', style }: SkeletonProps) {
  const baseClasses = 'bg-slate-200 rounded';
  
  const variants = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
    shimmer: 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent',
  };

  return (
    <div className={cn(baseClasses, variants[variant], className)} style={style} />
  );
}

// ============================================================================
// Contract Card Skeleton
// ============================================================================

export function ContractCardSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant={variant} className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton variant={variant} className="h-5 w-48" />
            <Skeleton variant={variant} className="h-3 w-32" />
          </div>
        </div>
        <Skeleton variant={variant} className="h-6 w-20 rounded-full" />
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <Skeleton variant={variant} className="h-4 w-full" />
        <Skeleton variant={variant} className="h-4 w-3/4" />
      </div>
      
      {/* Footer */}
      <div className="flex items-center gap-4 pt-2 border-t border-slate-100">
        <Skeleton variant={variant} className="h-4 w-24" />
        <Skeleton variant={variant} className="h-4 w-24" />
        <div className="ml-auto">
          <Skeleton variant={variant} className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Contract List Skeleton
// ============================================================================

interface ContractListSkeletonProps {
  count?: number;
  variant?: 'pulse' | 'wave' | 'shimmer';
  layout?: 'grid' | 'list';
}

export function ContractListSkeleton({ 
  count = 6, 
  variant = 'shimmer',
  layout = 'grid'
}: ContractListSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton variant={variant} className="h-10 w-64 rounded-lg" />
          <Skeleton variant={variant} className="h-10 w-32 rounded-lg" />
        </div>
        <Skeleton variant={variant} className="h-10 w-36 rounded-lg" />
      </div>
      
      {/* Grid/List */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ContractCardSkeleton variant={variant} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <ContractRowSkeleton variant={variant} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Contract Row Skeleton (for list view)
// ============================================================================

export function ContractRowSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-4">
      <Skeleton variant={variant} className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton variant={variant} className="h-5 w-64 max-w-full" />
        <Skeleton variant={variant} className="h-3 w-40" />
      </div>
      <Skeleton variant={variant} className="h-6 w-20 rounded-full hidden sm:block" />
      <Skeleton variant={variant} className="h-4 w-24 hidden md:block" />
      <Skeleton variant={variant} className="h-8 w-8 rounded-lg" />
    </div>
  );
}

// ============================================================================
// Dashboard Stats Skeleton
// ============================================================================

export function DashboardStatsSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white rounded-xl border border-slate-200 p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <Skeleton variant={variant} className="h-4 w-20" />
            <Skeleton variant={variant} className="w-8 h-8 rounded-lg" />
          </div>
          <Skeleton variant={variant} className="h-8 w-24 mb-2" />
          <Skeleton variant={variant} className="h-3 w-16" />
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Chart Skeleton
// ============================================================================

export function ChartSkeleton({ 
  variant = 'shimmer',
  height = 300 
}: { 
  variant?: 'pulse' | 'wave' | 'shimmer';
  height?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant={variant} className="h-6 w-40" />
        <div className="flex gap-2">
          <Skeleton variant={variant} className="h-8 w-20 rounded-lg" />
          <Skeleton variant={variant} className="h-8 w-20 rounded-lg" />
        </div>
      </div>
      <Skeleton 
        variant={variant} 
        className="w-full rounded-lg" 
        style={{ height }} 
      />
    </div>
  );
}

// ============================================================================
// Table Skeleton
// ============================================================================

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
  variant?: 'pulse' | 'wave' | 'shimmer';
}

export function TableSkeleton({ rows = 5, cols = 5, variant = 'shimmer' }: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 p-4">
        <div className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton 
              key={i} 
              variant={variant} 
              className={cn('h-4', i === 0 ? 'w-32' : 'w-24 flex-1')} 
            />
          ))}
        </div>
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <motion.div
          key={rowIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: rowIndex * 0.05 }}
          className="border-b border-slate-100 last:border-0 p-4"
        >
          <div className="flex items-center gap-4">
            {Array.from({ length: cols }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex} 
                variant={variant} 
                className={cn(
                  'h-4',
                  colIndex === 0 ? 'w-40' : 'w-20 flex-1'
                )} 
              />
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================================================
// Detail Page Skeleton
// ============================================================================

export function ContractDetailSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton variant={variant} className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton variant={variant} className="h-7 w-64" />
            <Skeleton variant={variant} className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton variant={variant} className="h-10 w-24 rounded-lg" />
          <Skeleton variant={variant} className="h-10 w-10 rounded-lg" />
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 pb-px">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant={variant} className="h-10 w-28 rounded-t-lg" />
        ))}
      </div>
      
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <Skeleton variant={variant} className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              <Skeleton variant={variant} className="h-4 w-full" />
              <Skeleton variant={variant} className="h-4 w-full" />
              <Skeleton variant={variant} className="h-4 w-3/4" />
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <Skeleton variant={variant} className="h-6 w-32 mb-4" />
            <Skeleton variant={variant} className="h-48 w-full rounded-lg" />
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <Skeleton variant={variant} className="h-5 w-28 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton variant={variant} className="h-4 w-20" />
                  <Skeleton variant={variant} className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <Skeleton variant={variant} className="h-5 w-24 mb-4" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant={variant} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Profile/Avatar Skeleton
// ============================================================================

export function ProfileSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="flex items-center gap-3">
      <Skeleton variant={variant} className="w-10 h-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton variant={variant} className="h-4 w-32" />
        <Skeleton variant={variant} className="h-3 w-24" />
      </div>
    </div>
  );
}

// ============================================================================
// Notification Skeleton
// ============================================================================

export function NotificationSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-slate-100">
      <Skeleton variant={variant} className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant={variant} className="h-4 w-full" />
        <Skeleton variant={variant} className="h-3 w-3/4" />
        <Skeleton variant={variant} className="h-3 w-20" />
      </div>
    </div>
  );
}

// ============================================================================
// Upload Progress Skeleton
// ============================================================================

export function UploadProgressSkeleton({ variant = 'shimmer' }: { variant?: 'pulse' | 'wave' | 'shimmer' }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton variant={variant} className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton variant={variant} className="h-5 w-48 mb-2" />
          <Skeleton variant={variant} className="h-2 w-full rounded-full" />
        </div>
        <Skeleton variant={variant} className="w-12 h-6" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant={variant} className="h-4 w-20" />
        <Skeleton variant={variant} className="h-4 w-24" />
      </div>
    </div>
  );
}

"use client";

/**
 * Loading Skeletons for AI Components
 * 
 * Provides consistent skeleton loading states for all AI-related UI components.
 * Improves perceived performance during async operations.
 */

import React from 'react';
import { cn } from '@/lib/utils';

// Base Skeleton Component
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-slate-200 dark:bg-slate-700',
        className
      )}
      {...props}
    />
  );
}

// Analytics Dashboard Skeleton
export function AnalyticsDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Chart */}
        <div className="p-4 border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        
        {/* Model Distribution */}
        <div className="p-4 border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="flex items-center justify-center h-64">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Chat Message Skeleton
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={cn(
      'flex gap-3 p-4',
      isUser ? 'flex-row-reverse' : 'flex-row'
    )}>
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className={cn('space-y-2', isUser ? 'items-end' : 'items-start', 'flex flex-col')}>
        <Skeleton className={cn('h-4 w-20', isUser ? 'self-end' : '')} />
        <div className={cn(
          'rounded-lg p-3 space-y-2',
          isUser ? 'bg-violet-100' : 'bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800'
        )}>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    </div>
  );
}

// Chat History Skeleton
export function ChatHistorySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} isUser={i % 2 === 0} />
      ))}
    </div>
  );
}

// Suggestions Panel Skeleton
export function SuggestionsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="p-3 space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <div className="flex items-center gap-2 pt-1">
                  <Skeleton className="h-6 w-20 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Usage Quota Skeleton
export function UsageQuotaSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 rounded-b-lg">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

// Search Results Skeleton
export function SearchResultsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-md flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex items-center justify-between pt-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Contract Diff Skeleton
export function ContractDiffSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <Skeleton className="h-5 w-5 rounded" />
          <div>
            <Skeleton className="h-5 w-40 mb-1" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-2 divide-x divide-slate-200">
        {/* Left Panel */}
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={`left-${i}`} className="flex items-start gap-2">
              <Skeleton className="h-5 w-8 flex-shrink-0" />
              <Skeleton className={cn('h-5', i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-4/5' : 'w-3/5')} />
            </div>
          ))}
        </div>
        
        {/* Right Panel */}
        <div className="p-4 space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={`right-${i}`} className="flex items-start gap-2">
              <Skeleton className="h-5 w-8 flex-shrink-0" />
              <Skeleton className={cn('h-5', i % 3 === 0 ? 'w-3/5' : i % 3 === 1 ? 'w-full' : 'w-4/5')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Batch Analysis Skeleton
export function BatchAnalysisSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      {/* Contract List */}
      <div className="divide-y divide-slate-100">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 flex items-center gap-4">
            <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
            <Skeleton className="h-10 w-10 rounded flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 rounded-b-lg">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-28 rounded" />
        </div>
      </div>
    </div>
  );
}

// Prompt Template Skeleton
export function PromptTemplateSkeleton() {
  return (
    <div className="border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 rounded-lg p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 mt-3">
            <Skeleton className="h-7 w-20 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline Loading Dots
export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-slate-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

// Typing Indicator (for chat)
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
        <div className="text-violet-600 text-xs font-bold">AI</div>
      </div>
      <div className="bg-slate-100 dark:bg-slate-800 dark:bg-slate-800 dark:bg-slate-800 rounded-lg px-4 py-3">
        <LoadingDots />
      </div>
    </div>
  );
}

// Shimmer Effect (for premium feel)
export function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-200 rounded-md',
        'before:absolute before:inset-0',
        'before:-translate-x-full',
        'before:animate-[shimmer_2s_infinite]',
        'before:bg-gradient-to-r',
        'before:from-transparent before:via-white/60 before:to-transparent',
        className
      )}
    />
  );
}

export default {
  Skeleton,
  AnalyticsDashboardSkeleton,
  ChatMessageSkeleton,
  ChatHistorySkeleton,
  SuggestionsSkeleton,
  UsageQuotaSkeleton,
  SearchResultsSkeleton,
  ContractDiffSkeleton,
  BatchAnalysisSkeleton,
  PromptTemplateSkeleton,
  LoadingDots,
  TypingIndicator,
  ShimmerSkeleton,
};

/**
 * Skeleton Loading Components for Artifacts
 * Provides shimmer effect while artifacts are loading
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Premium shimmer effect component
function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-violet-200/40 dark:via-violet-400/20 to-transparent" />
    </div>
  );
}

// Base skeleton with shimmer
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gradient-to-r from-slate-200 via-violet-100/50 to-slate-200 dark:from-slate-800 dark:via-violet-900/30 dark:to-slate-800 rounded-lg animate-pulse relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/60 dark:via-violet-400/10 to-transparent" />
    </div>
  );
}

export function SkeletonArtifactCard() {
  return (
    <Card className="overflow-hidden border-2 animate-pulse relative">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-10 pointer-events-none" />
      
      <CardHeader className="bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 border-b-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Icon skeleton with gradient */}
            <div className="p-3 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-gray-700 dark:to-gray-600 shadow-md h-14 w-14"></div>
            <div>
              {/* Title skeleton */}
              <div className="h-7 w-32 bg-gradient-to-r from-slate-200 to-slate-300 dark:bg-gray-700 rounded mb-2"></div>
              {/* Confidence skeleton */}
              <div className="h-4 w-24 bg-gradient-to-r from-slate-200 to-slate-300 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Badge skeleton */}
            <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-300 dark:bg-gray-700 rounded-full"></div>
            {/* Button skeleton */}
            <div className="h-9 w-24 bg-gradient-to-r from-slate-200 to-slate-300 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-8 pb-6 px-8">
        <div className="space-y-6">
          {/* Content skeletons */}
          <div className="space-y-4">
            <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:bg-gray-700 rounded-xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonArtifactList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6 max-w-[1600px]">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonArtifactCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonContractOverview() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header section */}
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-8 w-3/4 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg"></div>
          <div className="h-5 w-1/2 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg"></div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-xl"></div>
          <div className="h-10 w-24 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-xl"></div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 bg-white/50 dark:bg-slate-900/50">
            <div className="h-4 w-24 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded mb-3"></div>
            <div className="h-8 w-32 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg"></div>
          </Card>
        ))}
      </div>

      {/* Details section */}
      <Card className="mt-6 bg-white/50 dark:bg-slate-900/50">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div className="h-5 w-32 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded"></div>
                <div className="h-5 w-48 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Generic page-level skeleton for Suspense fallbacks.
 * Renders metric cards + a content area placeholder.
 */
export function PageSkeleton({ cards = 3, rows = 4 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-6 animate-pulse p-6">
      <div className="h-8 w-48 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(cards)].map((_, i) => (
          <div key={i} className="h-24 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-12 bg-gradient-to-r from-slate-200 to-violet-100/50 dark:from-slate-700 dark:to-violet-900/30 rounded-lg" style={{ width: `${90 - i * 5}%` }} />
        ))}
      </div>
    </div>
  );
}

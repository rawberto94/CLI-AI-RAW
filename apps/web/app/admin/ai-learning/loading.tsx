'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function AILearningLoading() {
  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="border rounded-lg p-4 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="h-64 flex items-end gap-2">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t animate-pulse" style={{ height: `${30 + Math.random() * 70}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

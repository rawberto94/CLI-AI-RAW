"use client";

import { memo } from "react";

/**
 * Skeleton row that mirrors the exact flex layout + column widths
 * of the table header in contracts/page.tsx and CompactContractRow.
 */
export const ContractRowSkeleton = memo(function ContractRowSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 border-b border-slate-100/80 bg-white"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Checkbox — w-10 flex-shrink-0 */}
      <div className="w-10 flex-shrink-0 flex items-center justify-center">
        <div className="h-4 w-4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded motion-safe:animate-pulse" />
      </div>

      {/* Contract (icon + title) — flex-1 min-w-[200px] */}
      <div className="flex-1 min-w-[200px] flex items-center gap-3">
        <div className="h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-xl motion-safe:animate-pulse shadow-sm flex-shrink-0" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-3/4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-md motion-safe:animate-pulse" />
          <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded motion-safe:animate-pulse" />
        </div>
      </div>

      {/* Category — hidden lg:block w-[120px] */}
      <div className="hidden lg:block w-[120px]">
        <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-md motion-safe:animate-pulse" />
      </div>

      {/* Type — hidden lg:block w-[90px] */}
      <div className="hidden lg:block w-[90px]">
        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      </div>

      {/* Party — hidden md:block w-[140px] */}
      <div className="hidden md:block w-[140px]">
        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      </div>

      {/* Value — hidden lg:block w-[100px] */}
      <div className="hidden lg:block w-[100px]">
        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse text-right" />
      </div>

      {/* Expires — hidden md:block w-[100px] */}
      <div className="hidden md:block w-[100px]">
        <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      </div>

      {/* Signed — hidden lg:block w-[80px] */}
      <div className="hidden lg:block w-[80px]">
        <div className="h-6 w-16 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full motion-safe:animate-pulse shadow-sm" />
      </div>

      {/* Status — w-[100px] */}
      <div className="w-[100px]">
        <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full motion-safe:animate-pulse" />
      </div>

      {/* Actions — w-10 flex-shrink-0 */}
      <div className="w-10 flex-shrink-0">
        <div className="h-7 w-7 bg-slate-100 dark:bg-slate-700 rounded-lg motion-safe:animate-pulse" />
      </div>
    </div>
  );
});

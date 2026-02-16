"use client";

import { memo } from "react";

export const ContractRowSkeleton = memo(function ContractRowSkeleton({ index }: { index: number }) {
  return (
    <div 
      className="grid grid-cols-[44px_1fr_140px_140px_140px_120px_130px_110px_50px] gap-4 px-5 py-4 items-center border-b border-slate-100/80 bg-white"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="h-4 w-4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded motion-safe:animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-xl motion-safe:animate-pulse shadow-sm" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-3/4 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-md motion-safe:animate-pulse" />
          <div className="h-3 w-1/4 bg-slate-100 dark:bg-slate-800 rounded motion-safe:animate-pulse" />
        </div>
      </div>
      <div className="h-6 w-20 bg-gradient-to-r from-slate-200 to-slate-100 rounded-md motion-safe:animate-pulse" />
      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded motion-safe:animate-pulse" />
      <div className="h-6 w-16 bg-gradient-to-r from-slate-200 to-slate-100 rounded-full motion-safe:animate-pulse shadow-sm" />
      <div className="h-7 w-7 bg-slate-100 dark:bg-slate-700 rounded-lg motion-safe:animate-pulse" />
    </div>
  );
});

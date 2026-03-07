'use client'

import React, { memo } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type SkeletonVariant = 'card' | 'timeline' | 'notes' | 'list' | 'compact'

interface SectionSkeletonProps {
  variant?: SkeletonVariant
  className?: string
  lines?: number
}

const shimmer = "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent"

export const SectionSkeleton = memo(function SectionSkeleton({
  variant = 'card',
  className,
  lines = 3,
}: SectionSkeletonProps) {
  if (variant === 'timeline') {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardHeader className="pb-2">
          <div className={cn("h-4 w-32 bg-slate-200 rounded", shimmer)} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar skeleton */}
          <div className={cn("h-2 w-full bg-slate-200 rounded-full", shimmer)} />
          
          {/* Milestones */}
          <div className="flex justify-between">
            {[1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className={cn("h-3 w-3 rounded-full bg-slate-200 mb-2", shimmer)} />
                <div className={cn("h-3 w-12 bg-slate-200 rounded", shimmer)} />
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (variant === 'notes') {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className={cn("h-4 w-24 bg-slate-200 rounded", shimmer)} />
            <div className={cn("h-8 w-20 bg-slate-200 rounded", shimmer)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map(i => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200"
            >
              <div className={cn("h-8 w-8 rounded-full bg-slate-200 shrink-0", shimmer)} />
              <div className="flex-1 space-y-2">
                <div className={cn("h-3 w-24 bg-slate-200 rounded", shimmer)} />
                <div className={cn("h-3 w-full bg-slate-200 rounded", shimmer)} />
                <div className={cn("h-3 w-3/4 bg-slate-200 rounded", shimmer)} />
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (variant === 'list') {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardHeader className="pb-2">
          <div className={cn("h-4 w-32 bg-slate-200 rounded", shimmer)} />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-2 rounded border border-slate-100"
            >
              <div className={cn("h-8 w-8 rounded bg-slate-200", shimmer)} />
              <div className="flex-1">
                <div className={cn("h-3 w-24 bg-slate-200 rounded mb-1", shimmer)} />
                <div className={cn("h-2 w-16 bg-slate-100 rounded", shimmer)} />
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn("h-4 bg-slate-200 rounded", shimmer)}
            style={{ width: `${100 - i * 15}%` }}
          />
        ))}
      </div>
    )
  }

  // Default card variant
  return (
    <Card className={cn("border-slate-200", className)}>
      <CardHeader className="pb-2">
        <div className={cn("h-4 w-28 bg-slate-200 rounded", shimmer)} />
        <div className={cn("h-3 w-40 bg-slate-100 rounded mt-1", shimmer)} />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn("h-4 bg-slate-200 rounded", shimmer)}
            style={{ width: `${100 - i * 10}%` }}
          />
        ))}
      </CardContent>
    </Card>
  )
})

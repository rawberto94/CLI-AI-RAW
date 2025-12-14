'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScoreRing } from '@/components/artifacts/ArtifactCards'

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color = 'slate',
  score,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subValue?: string
  color?: 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'slate'
  score?: number
}) {
  const gradientClasses = {
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-violet-600',
    slate: 'from-slate-500 to-gray-600',
  }

  const bgClasses = {
    emerald: 'bg-emerald-50/50 border-emerald-100/50',
    amber: 'bg-amber-50/50 border-amber-100/50',
    red: 'bg-red-50/50 border-red-100/50',
    blue: 'bg-blue-50/50 border-blue-100/50',
    purple: 'bg-purple-50/50 border-purple-100/50',
    slate: 'bg-slate-50/50 border-slate-100/50',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'bg-white/90 backdrop-blur-sm rounded-xl border p-4 transition-all duration-300 hover:shadow-lg',
        bgClasses[color]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div
            className={cn(
              'inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3 shadow-lg',
              `bg-gradient-to-br ${gradientClasses[color]}`
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent mt-1">
            {value}
          </p>
          {subValue ? <p className="text-xs text-slate-500 mt-0.5">{subValue}</p> : null}
        </div>
        {score !== undefined ? <ScoreRing score={score} size="sm" /> : null}
      </div>
    </motion.div>
  )
}

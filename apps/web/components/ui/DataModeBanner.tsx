'use client'

import React from 'react'
import { useDataMode } from '@/contexts/DataModeContext'
import { AlertTriangle, Sparkles, TestTube } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DataModeBanner() {
  const { dataMode, isRealData } = useDataMode()

  if (isRealData) return null

  return (
    <div
      className={cn(
        'fixed top-16 lg:top-0 left-0 right-0 lg:left-64 z-40 px-4 py-2 text-sm font-medium text-center',
        dataMode === 'mock' ? 'bg-blue-100 text-blue-900' : 'bg-purple-100 text-purple-900'
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {dataMode === 'mock' ? (
          <TestTube className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        <span>
          You're viewing <strong>{dataMode}</strong> data
        </span>
        <span className="hidden sm:inline">
          • Switch to <strong>Real</strong> mode for production data
        </span>
      </div>
    </div>
  )
}

'use client'

import { useDataMode } from '@/contexts/DataModeContext'
import { AlertTriangle, Info } from 'lucide-react'

export function DataModeBanner() {
  const { dataMode, isRealData } = useDataMode()

  // Only show banner when NOT in real data mode
  if (isRealData) {
    return null
  }

  const isMock = dataMode === 'mock'
  const isAI = dataMode === 'ai'

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 ${
        isMock
          ? 'bg-yellow-50 border-b border-yellow-200'
          : 'bg-purple-50 border-b border-purple-200'
      }`}
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-center gap-2 text-sm">
          {isMock ? (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="font-medium text-yellow-900">
                Mock Data Mode
              </span>
              <span className="text-yellow-700">
                You're viewing simulated data for testing purposes
              </span>
            </>
          ) : (
            <>
              <Info className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-purple-900">
                AI Generated Mode
              </span>
              <span className="text-purple-700">
                You're viewing AI-generated demo data
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

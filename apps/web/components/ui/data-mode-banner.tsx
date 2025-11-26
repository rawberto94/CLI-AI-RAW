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
  const isAI = (dataMode as any) === 'ai'

  // Temporarily disabled to fix overlay issue
  return null
}

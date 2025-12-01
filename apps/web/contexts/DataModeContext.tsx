'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type DataMode = 'real' | 'mock' | 'ai-generated'

interface DataModeContextType {
  dataMode: DataMode
  setDataMode: (mode: DataMode) => void
  isRealData: boolean
  isMockData: boolean
  isAIGenerated: boolean
  useRealData: boolean // Alias for isRealData for backwards compatibility
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined)

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  // Always default to 'real' mode - no mock data
  const [dataMode, setDataModeState] = useState<DataMode>('real')

  // Load from localStorage on mount, but override mock with real
  useEffect(() => {
    const saved = localStorage.getItem('dataMode') as DataMode
    // Force real mode - no mock data fallback
    if (saved === 'mock') {
      localStorage.setItem('dataMode', 'real')
      setDataModeState('real')
    } else if (saved && ['real', 'ai-generated'].includes(saved)) {
      setDataModeState(saved)
    }
  }, [])

  // Save to localStorage when changed
  const setDataMode = (mode: DataMode) => {
    setDataModeState(mode)
    localStorage.setItem('dataMode', mode)
  }

  const value: DataModeContextType = {
    dataMode,
    setDataMode,
    isRealData: dataMode === 'real',
    isMockData: false, // Always false - mock mode disabled
    isAIGenerated: dataMode === 'ai-generated',
    useRealData: dataMode === 'real'
  }

  return (
    <DataModeContext.Provider value={value}>
      {children}
    </DataModeContext.Provider>
  )
}

export function useDataMode() {
  const context = useContext(DataModeContext)
  if (context === undefined) {
    throw new Error('useDataMode must be used within a DataModeProvider')
  }
  return context
}

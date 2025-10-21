'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

type DataMode = 'real' | 'mock' | 'ai-generated'

interface DataModeContextType {
  dataMode: DataMode
  setDataMode: (mode: DataMode) => void
  isRealData: boolean
  isMockData: boolean
  isAIGenerated: boolean
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined)

export function DataModeProvider({ children }: { children: React.ReactNode }) {
  const [dataMode, setDataModeState] = useState<DataMode>('real')

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dataMode') as DataMode
    if (saved && ['real', 'mock', 'ai-generated'].includes(saved)) {
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
    isMockData: dataMode === 'mock',
    isAIGenerated: dataMode === 'ai-generated'
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

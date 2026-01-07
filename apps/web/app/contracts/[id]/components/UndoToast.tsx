'use client'

import React, { memo, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { X, Undo2 } from 'lucide-react'

interface UndoAction {
  id: string
  label: string
  onUndo: () => Promise<void>
  timeout: number // ms before auto-dismiss
}

interface UndoToastProps {
  action: UndoAction | null
  onDismiss: () => void
}

export const UndoToast = memo(function UndoToast({ action, onDismiss }: UndoToastProps) {
  const [isUndoing, setIsUndoing] = useState(false)
  const [progress, setProgress] = useState(100)
  
  useEffect(() => {
    if (!action) return
    
    setProgress(100)
    const startTime = Date.now()
    const duration = action.timeout
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      
      if (remaining <= 0) {
        clearInterval(interval)
        onDismiss()
      }
    }, 50)
    
    return () => clearInterval(interval)
  }, [action, onDismiss])
  
  const handleUndo = async () => {
    if (!action) return
    setIsUndoing(true)
    try {
      await action.onUndo()
    } finally {
      setIsUndoing(false)
      onDismiss()
    }
  }
  
  return (
    <AnimatePresence>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-slate-900 text-white rounded-lg shadow-xl px-4 py-3 flex items-center gap-3 min-w-[280px]">
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700 rounded-b-lg overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.05 }}
              />
            </div>
            
            <span className="text-sm flex-1">{action.label}</span>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={isUndoing}
              className="text-white hover:bg-slate-800 h-7 px-2 text-xs font-medium"
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" />
              Undo
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-6 w-6"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
})

// Hook for managing undo actions
export function useUndoToast() {
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null)
  
  const showUndo = useCallback((action: Omit<UndoAction, 'id'>) => {
    setUndoAction({
      ...action,
      id: `undo-${Date.now()}`,
    })
  }, [])
  
  const dismissUndo = useCallback(() => {
    setUndoAction(null)
  }, [])
  
  return {
    undoAction,
    showUndo,
    dismissUndo,
    UndoToastComponent: () => <UndoToast action={undoAction} onDismiss={dismissUndo} />,
  }
}

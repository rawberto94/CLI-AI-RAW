'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Command } from 'lucide-react'
import { keyboardShortcuts, KeyboardShortcutsManager } from '@/lib/keyboard-shortcuts'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const [shortcuts, setShortcuts] = useState<Array<{ id: string; shortcut: any }>>([])

  useEffect(() => {
    setShortcuts(keyboardShortcuts.getAll())
  }, [open])

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, { id, shortcut }) => {
    const category = shortcut.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push({ id, shortcut })
    return acc
  }, {} as Record<string, Array<{ id: string; shortcut: any }>>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these keyboard shortcuts to navigate and perform actions quickly
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200"></div>
                <span>{category}</span>
                <div className="h-px flex-1 bg-gray-200"></div>
              </h3>
              <div className="space-y-2">
                {categoryShortcuts.map(({ id, shortcut }) => (
                  <div
                    key={id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm text-gray-700">{shortcut.description}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {KeyboardShortcutsManager.formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedShortcuts).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No keyboard shortcuts registered</p>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-start gap-3">
            <Command className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-900 mb-1">Pro Tip</h4>
              <p className="text-sm text-blue-700">
                Press <kbd className="px-2 py-1 bg-white rounded border border-blue-200 font-mono text-xs">
                  {typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? '⌘' : 'Ctrl'}+/
                </kbd> anytime to view this shortcuts list
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
